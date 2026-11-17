import type { Pool, PoolClient } from 'pg';
import { ErreurHttp } from '../http/erreur-http.js';
import { DevisRepository } from './devis.repository.js';

/** Bloc « compte » du profil : identite de connexion, jamais de hache. */
export interface CompteProfil {
  prenom: string;
  nom: string;
  nom_utilisateur: string;
  email_connexion: string;
}
/** Bloc « coordonnees » du profil, present seulement si une fiche client existe. */
export interface FicheProfil {
  entreprise: string;
  prenom_contact: string;
  nom_contact: string;
  email_contact: string;
  telephone: string;
  adresse_postale: string | null;
}
export interface Profil {
  compte: CompteProfil;
  fiche: FicheProfil | null;
}

const PROJECTION_EVENEMENT = `e.id_evenement::text,e.nom,to_json(e.date_debut)#>>'{}' AS date_debut,
 to_json(e.date_fin)#>>'{}' AS date_fin,e.lieu,e.statut_evenement`;

/**
 * Requetes de l'espace client. La propriete est toujours verifiee ici, par
 * clients.id_utilisateur = compte de la session : la ressource d'un autre client est introuvable.
 */
export class EspaceClientRepository {
  private readonly transactions: DevisRepository;
  constructor(private readonly pool: Pool) {
    this.transactions = new DevisRepository(pool);
  }

  /** Trois prochains evenements (hors annules et termines) et suivi des demandes rattachees. */
  async accueil(idUtilisateur: string) {
    const [prochains, suivi] = await Promise.all([
      this.pool.query(
        `SELECT ${PROJECTION_EVENEMENT} FROM innov_events.evenements e
        JOIN innov_events.clients c ON c.id_client=e.id_client
        WHERE c.id_utilisateur=$1 AND e.date_debut>=NOW()
          AND e.statut_evenement NOT IN ('annule','termine')
        ORDER BY e.date_debut,e.id_evenement LIMIT 3`,
        [idUtilisateur],
      ),
      this.pool.query(
        `SELECT p.id_prospect::text,to_json(p.date_demande)#>>'{}' AS date_demande,
          p.id_type_evenement,t.libelle AS libelle_type,p.statut_prospect,
          (SELECT json_build_object('id_evenement',e.id_evenement::text,'nom',e.nom,
             'statut_evenement',e.statut_evenement,
             'devis',COALESCE((SELECT json_agg(json_build_object('id_devis',d.id_devis::text,
               'intitule',d.intitule,'statut_devis',d.statut_devis,
               'date_envoi',to_json(d.date_envoi)#>>'{}') ORDER BY d.date_envoi,d.id_devis)
               FROM innov_events.devis d WHERE d.id_evenement=e.id_evenement
               AND d.date_envoi IS NOT NULL),'[]'::json))
           FROM innov_events.evenements e WHERE e.id_prospect=p.id_prospect) AS evenement
        FROM innov_events.prospects p
        JOIN innov_events.clients c ON c.id_client=p.id_client
        JOIN innov_events.types_evenement t ON t.id_type_evenement=p.id_type_evenement
        WHERE c.id_utilisateur=$1
        ORDER BY p.date_demande DESC,p.id_prospect DESC`,
        [idUtilisateur],
      ),
    ]);
    return { prochains_evenements: prochains.rows, suivi: suivi.rows };
  }

  /** Compte et fiche du titulaire ; une fiche anonymisee n'est plus rattachee a un compte. */
  async profil(idUtilisateur: string, db: Pool | PoolClient = this.pool): Promise<Profil> {
    const compte = (
      await db.query<CompteProfil>(
        `SELECT prenom,nom,nom_utilisateur,email_connexion FROM innov_events.utilisateurs
        WHERE id_utilisateur=$1`,
        [idUtilisateur],
      )
    ).rows[0];
    if (!compte) throw new ErreurHttp(404, 'Compte introuvable.');
    const fiche = (
      await db.query<FicheProfil>(
        `SELECT entreprise,prenom_contact,nom_contact,email_contact,telephone,adresse_postale
        FROM innov_events.clients WHERE id_utilisateur=$1 AND date_anonymisation IS NULL`,
        [idUtilisateur],
      )
    ).rows[0];
    return { compte, fiche: fiche ?? null };
  }

  /** Hache du mot de passe choisi, lu seulement pour une verification par le service. */
  async hacheMotDePasse(idUtilisateur: string): Promise<string | null> {
    return (
      (
        await this.pool.query<{ mot_de_passe_hache: string | null }>(
          'SELECT mot_de_passe_hache FROM innov_events.utilisateurs WHERE id_utilisateur=$1',
          [idUtilisateur],
        )
      ).rows[0]?.mot_de_passe_hache ?? null
    );
  }

  /**
   * Modifie le compte et la fiche dans une transaction, sous verrou du compte.
   * Renvoie l'identifiant de la fiche si ses coordonnees ont change (journalisation).
   */
  async modifierProfil(
    idUtilisateur: string,
    compte: CompteProfil | null,
    fiche: FicheProfil | null,
  ): Promise<{ profil: Profil; fiche_modifiee: string | null }> {
    return this.transactions.transaction(async (db) => {
      const verrou = await db.query(
        'SELECT 1 FROM innov_events.utilisateurs WHERE id_utilisateur=$1 FOR UPDATE',
        [idUtilisateur],
      );
      if (!verrou.rowCount) throw new ErreurHttp(404, 'Compte introuvable.');
      if (compte)
        await db.query(
          `UPDATE innov_events.utilisateurs SET prenom=$2,nom=$3,nom_utilisateur=$4,email_connexion=$5
          WHERE id_utilisateur=$1`,
          [
            idUtilisateur,
            compte.prenom,
            compte.nom,
            compte.nom_utilisateur,
            compte.email_connexion,
          ],
        );
      let ficheModifiee: string | null = null;
      if (fiche) {
        const r = await db.query<{ id_client: string; change: boolean }>(
          `WITH avant AS (
            SELECT id_client,entreprise,prenom_contact,nom_contact,email_contact,telephone,adresse_postale
            FROM innov_events.clients WHERE id_utilisateur=$1 AND date_anonymisation IS NULL FOR UPDATE)
          UPDATE innov_events.clients c SET entreprise=$2,prenom_contact=$3,nom_contact=$4,
            email_contact=$5,telephone=$6,adresse_postale=$7
          FROM avant WHERE c.id_client=avant.id_client
          RETURNING c.id_client::text,
            (avant.entreprise,avant.prenom_contact,avant.nom_contact,avant.email_contact,
             avant.telephone,avant.adresse_postale) IS DISTINCT FROM ($2,$3,$4,$5,$6,$7) AS change`,
          [
            idUtilisateur,
            fiche.entreprise,
            fiche.prenom_contact,
            fiche.nom_contact,
            fiche.email_contact,
            fiche.telephone,
            fiche.adresse_postale,
          ],
        );
        if (!r.rows[0]) throw new ErreurHttp(409, 'Aucune fiche client à modifier.');
        if (r.rows[0].change) ficheModifiee = r.rows[0].id_client;
      }
      return { profil: await this.profil(idUtilisateur, db), fiche_modifiee: ficheModifiee };
    });
  }

  /** Fiche non anonymisee rattachee au compte, ou null. */
  async ficheActive(idUtilisateur: string): Promise<string | null> {
    return (
      (
        await this.pool.query<{ id_client: string }>(
          `SELECT id_client::text FROM innov_events.clients
          WHERE id_utilisateur=$1 AND date_anonymisation IS NULL`,
          [idUtilisateur],
        )
      ).rows[0]?.id_client ?? null
    );
  }

  /** Vrai si la fiche est anonymisee (effacement enregistre en base). */
  async ficheAnonymisee(idClient: string): Promise<boolean> {
    return !!(
      await this.pool.query(
        `SELECT 1 FROM innov_events.clients WHERE id_client=$1 AND date_anonymisation IS NOT NULL`,
        [idClient],
      )
    ).rowCount;
  }

  /**
   * Effacement demande par le client, en une transaction : sessions detruites, demandes non
   * converties du meme e-mail (connexion ou contact) effacees, puis fiche anonymisee par la
   * fonction de reference, ou seul compte supprime s'il n'a pas de fiche.
   * La fiche verrouillee doit etre celle annoncee au journal avant la transaction : sinon 409.
   */
  async effacer(idUtilisateur: string, idClientAttendu: string | null): Promise<void> {
    await this.transactions.transaction(async (db) => {
      const u = (
        await db.query<{ email_connexion: string }>(
          `SELECT email_connexion FROM innov_events.utilisateurs
          WHERE id_utilisateur=$1 AND role='client' FOR UPDATE`,
          [idUtilisateur],
        )
      ).rows[0];
      if (!u) throw new ErreurHttp(404, 'Compte introuvable.');
      const fiche = (
        await db.query<{ id_client: string; email_contact: string }>(
          `SELECT id_client::text,email_contact FROM innov_events.clients
          WHERE id_utilisateur=$1 AND date_anonymisation IS NULL FOR UPDATE`,
          [idUtilisateur],
        )
      ).rows[0];
      if ((fiche?.id_client ?? null) !== idClientAttendu)
        throw new ErreurHttp(409, 'Votre fiche client a changé pendant la demande. Réessayez.');
      await db.query(
        `DELETE FROM innov_events.sessions WHERE sess->'authentification'->>'id_utilisateur'=$1`,
        [idUtilisateur],
      );
      await db.query(
        `DELETE FROM innov_events.prospects WHERE id_client IS NULL
        AND LOWER(email) IN (LOWER($1),LOWER($2))`,
        [u.email_connexion, fiche?.email_contact ?? u.email_connexion],
      );
      if (fiche)
        await db.query('SELECT innov_events.supprimer_compte_client($1)', [fiche.id_client]);
      else
        await db.query('DELETE FROM innov_events.utilisateurs WHERE id_utilisateur=$1', [
          idUtilisateur,
        ]);
    });
  }

  /** Tous les evenements du client, avec l'accord de publication et son avis eventuel. */
  async evenements(idUtilisateur: string) {
    return (
      await this.pool.query(
        `SELECT ${PROJECTION_EVENEMENT},t.libelle AS libelle_type,
          to_json(e.date_accord_publication)#>>'{}' AS date_accord_publication,e.visible_public,
          (SELECT json_build_object('note_evaluation',a.note_evaluation,'commentaire',a.commentaire,
             'statut_avis',a.statut_avis,'date_creation',to_json(a.date_creation)#>>'{}')
           FROM innov_events.avis a WHERE a.id_evenement=e.id_evenement) AS avis
        FROM innov_events.evenements e
        JOIN innov_events.clients c ON c.id_client=e.id_client
        JOIN innov_events.types_evenement t ON t.id_type_evenement=e.id_type_evenement
        WHERE c.id_utilisateur=$1
        ORDER BY e.date_debut DESC,e.id_evenement DESC`,
        [idUtilisateur],
      )
    ).rows;
  }

  /** Verrouille l'evenement du client ; celui d'un autre client repond 404. */
  private async evenementDuClient(db: PoolClient, id: string, idUtilisateur: string) {
    const e = (
      await db.query<{ statut_evenement: string }>(
        `SELECT e.statut_evenement FROM innov_events.evenements e
        JOIN innov_events.clients c ON c.id_client=e.id_client
        WHERE e.id_evenement=$1 AND c.id_utilisateur=$2 FOR UPDATE OF e`,
        [id, idUtilisateur],
      )
    ).rows[0];
    if (!e) throw new ErreurHttp(404, 'Événement introuvable.');
    return e;
  }

  /** Un seul avis, sur un evenement termine, en attente de moderation. */
  async creerAvis(id: string, idUtilisateur: string, note: number, commentaire: string) {
    return this.transactions.transaction(async (db) => {
      const e = await this.evenementDuClient(db, id, idUtilisateur);
      if (e.statut_evenement !== 'termine')
        throw new ErreurHttp(409, 'Un avis ne peut être donné que sur un événement terminé.');
      if ((await db.query('SELECT 1 FROM innov_events.avis WHERE id_evenement=$1', [id])).rowCount)
        throw new ErreurHttp(409, 'Un avis a déjà été donné pour cet événement.');
      return (
        await db.query<{ id_avis: string; statut_avis: string }>(
          `INSERT INTO innov_events.avis(id_evenement,commentaire,note_evaluation)
          VALUES($1,$2,$3) RETURNING id_avis::text,statut_avis`,
          [id, commentaire, note],
        )
      ).rows[0]!;
    });
  }

  /** Donne l'accord (date conservee s'il existe deja) ou le retire. */
  async accordPublication(id: string, idUtilisateur: string, accord: boolean) {
    return this.transactions.transaction(async (db) => {
      await this.evenementDuClient(db, id, idUtilisateur);
      return (
        await db.query<{ date_accord_publication: string | null }>(
          `UPDATE innov_events.evenements SET date_accord_publication=
            CASE WHEN $2::boolean THEN COALESCE(date_accord_publication,NOW()) ELSE NULL END
          WHERE id_evenement=$1 RETURNING to_json(date_accord_publication)#>>'{}' AS date_accord_publication`,
          [id, accord],
        )
      ).rows[0]!;
    });
  }
}
