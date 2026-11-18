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

  /**
   * Verrouille le compte et verifie, sous ce verrou, que le mot de passe qui a autorise la
   * requete est toujours celui du compte : un mot de passe remplace entre la verification de
   * la session et l'ecriture (rattachement a l'envoi d'un devis, changement, suspension)
   * annule l'operation. Renvoie l'e-mail de connexion lu sous ce verrou.
   */
  private async verrouillerCompte(
    db: PoolClient,
    idUtilisateur: string,
    hacheSession: string,
  ): Promise<string> {
    const u = (
      await db.query<{
        email_connexion: string;
        mot_de_passe_hache: string | null;
        statut_compte: string;
      }>(
        `SELECT email_connexion,mot_de_passe_hache,statut_compte FROM innov_events.utilisateurs
        WHERE id_utilisateur=$1 AND role='client' FOR UPDATE`,
        [idUtilisateur],
      )
    ).rows[0];
    if (!u) throw new ErreurHttp(404, 'Compte introuvable.');
    if (u.statut_compte !== 'actif' || u.mot_de_passe_hache !== hacheSession)
      throw new ErreurHttp(401, 'Session invalide.');
    return u.email_connexion;
  }

  /**
   * Modifie le compte et la fiche dans une transaction, sous verrou du compte.
   * Renvoie l'identifiant de la fiche si ses coordonnees ont change (journalisation).
   */
  async modifierProfil(
    idUtilisateur: string,
    hacheSession: string,
    compte: CompteProfil | null,
    fiche: FicheProfil | null,
    motDePasseVerifie: boolean,
  ): Promise<{ profil: Profil; fiche_modifiee: string | null }> {
    return this.transactions.transaction(async (db) => {
      const emailActuel = await this.verrouillerCompte(db, idUtilisateur, hacheSession);
      // Comparaison sur l'adresse en base sous le verrou : une sauvegarde partie avant un
      // changement d'adresse confirme ne peut pas retablir l'ancienne sans mot de passe.
      if (
        compte &&
        !motDePasseVerifie &&
        emailActuel.toLowerCase() !== compte.email_connexion.toLowerCase()
      )
        throw new ErreurHttp(400, 'Mot de passe actuel incorrect.', 'MOT_DE_PASSE_ACTUEL_INVALIDE');
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
        const avant = await db.query<{ email_contact: string | null }>(
          `SELECT email_contact FROM innov_events.clients
          WHERE id_utilisateur=$1 AND date_anonymisation IS NULL FOR UPDATE`,
          [idUtilisateur],
        );
        if (!avant.rows[0]) throw new ErreurHttp(409, 'Aucune fiche client à modifier.');
        // L'e-mail de contact rattache les demandes et les devis a la fiche : une adresse non
        // verifiee saisie par le client pourrait capter ceux d'une autre entreprise.
        if ((avant.rows[0].email_contact ?? '').toLowerCase() !== fiche.email_contact.toLowerCase())
          throw new ErreurHttp(
            400,
            'L’e-mail du contact est géré par Innov’Events : écrivez-nous depuis la page Contact pour le modifier.',
            'EMAIL_CONTACT_NON_MODIFIABLE',
          );
        const r = await db.query<{ id_client: string; change: boolean }>(
          `WITH avant AS (
            SELECT id_client,entreprise,prenom_contact,nom_contact,telephone,adresse_postale
            FROM innov_events.clients WHERE id_utilisateur=$1 AND date_anonymisation IS NULL)
          UPDATE innov_events.clients c SET entreprise=$2,prenom_contact=$3,nom_contact=$4,
            telephone=$5,adresse_postale=$6
          FROM avant WHERE c.id_client=avant.id_client
          RETURNING c.id_client::text,
            (avant.entreprise,avant.prenom_contact,avant.nom_contact,
             avant.telephone,avant.adresse_postale) IS DISTINCT FROM ($2,$3,$4,$5,$6) AS change`,
          [
            idUtilisateur,
            fiche.entreprise,
            fiche.prenom_contact,
            fiche.nom_contact,
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
   * converties portant l'e-mail de contact de la fiche effacees, puis fiche anonymisee par la
   * fonction de reference, ou seul compte supprime s'il n'a pas de fiche (aucune demande).
   * La fiche verrouillee doit etre celle annoncee au journal avant la transaction : sinon 409.
   */
  async effacer(
    idUtilisateur: string,
    hacheSession: string,
    idClientAttendu: string | null,
  ): Promise<void> {
    await this.transactions.transaction(async (db) => {
      await this.verrouillerCompte(db, idUtilisateur, hacheSession);
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
      // Seul l'e-mail de contact de la fiche, issu de la demande convertie ou saisi par
      // l'administratrice, designe les demandes du client ; l'e-mail de connexion, choisi
      // librement et jamais verifie, pourrait designer celles d'un tiers.
      if (fiche) await supprimerDemandesDeLaFiche(db, fiche.id_client);
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

/**
 * Supprime les demandes non converties portant l'e-mail de contact de la fiche, sauf si une
 * autre fiche active porte la meme adresse : leur appartenance est alors ambigue et elles sont
 * conservees. A appeler avant l'anonymisation de la fiche, dans la transaction de suppression.
 */
export async function supprimerDemandesDeLaFiche(db: PoolClient, idClient: string): Promise<void> {
  await db.query(
    `DELETE FROM innov_events.prospects p USING innov_events.clients f
    WHERE f.id_client=$1 AND f.email_contact IS NOT NULL AND p.id_client IS NULL
      AND LOWER(p.email)=LOWER(f.email_contact)
      AND NOT EXISTS (SELECT 1 FROM innov_events.clients autre
        WHERE autre.id_client<>f.id_client AND autre.date_anonymisation IS NULL
          AND LOWER(autre.email_contact)=LOWER(f.email_contact))`,
    [idClient],
  );
}
