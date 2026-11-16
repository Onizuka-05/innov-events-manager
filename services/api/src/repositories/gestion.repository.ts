import type { Pool, PoolClient } from 'pg';
import { ErreurHttp } from '../http/erreur-http.js';
import { DevisRepository } from './devis.repository.js';
import type {
  ClientSaisie,
  EvenementModification,
  CompteSaisie,
  TacheSaisie,
} from '../services/gestion.types.js';

const CLIENT = `c.id_client::text,c.id_utilisateur::text,c.entreprise,c.nom_contact,c.prenom_contact,
 c.email_contact,c.telephone,c.adresse_postale,to_json(c.date_anonymisation)#>>'{}' AS date_anonymisation`;
const EVENEMENT = `e.id_evenement::text,e.id_client::text,e.id_prospect::text,e.id_type_evenement,e.id_theme,
 e.nom,to_json(e.date_debut)#>>'{}' AS date_debut,to_json(e.date_fin)#>>'{}' AS date_fin,e.lieu,e.statut_evenement,e.image_url,
 e.visible_public,to_json(e.date_accord_publication)#>>'{}' AS date_accord_publication,c.entreprise`;

/** Requetes et transactions des espaces de gestion, sans modification du schema. */
export class GestionRepository {
  private readonly transactions: DevisRepository;
  constructor(private readonly pool: Pool) {
    this.transactions = new DevisRepository(pool);
  }

  /** Liste recherchee sans exposer les donnees d'authentification. */
  async clients(recherche = '') {
    return (
      await this.pool.query(
        `SELECT ${CLIENT} FROM innov_events.clients c
      WHERE concat_ws(' ',c.entreprise,c.nom_contact,c.prenom_contact,c.email_contact) ILIKE $1
      ORDER BY c.entreprise NULLS LAST,c.id_client`,
        ['%' + recherche + '%'],
      )
    ).rows;
  }
  /** Coordonnees et historique des evenements du client. */
  async client(id: string) {
    const c = (
      await this.pool.query(`SELECT ${CLIENT} FROM innov_events.clients c WHERE c.id_client=$1`, [
        id,
      ])
    ).rows[0];
    if (!c) throw new ErreurHttp(404, 'Client introuvable.');
    return {
      ...c,
      evenements: (
        await this.pool.query(
          `SELECT ${EVENEMENT} FROM innov_events.evenements e
      JOIN innov_events.clients c USING(id_client) WHERE e.id_client=$1 ORDER BY e.date_debut DESC`,
          [id],
        )
      ).rows,
    };
  }
  /** Cree ou modifie une fiche encore nominative. */
  async enregistrerClient(d: ClientSaisie, id?: string) {
    const valeurs = [
      d.entreprise,
      d.nom_contact,
      d.prenom_contact,
      d.email_contact,
      d.telephone,
      d.adresse_postale,
    ];
    const r = id
      ? await this.pool.query(
          `UPDATE innov_events.clients SET entreprise=$1,nom_contact=$2,
      prenom_contact=$3,email_contact=$4,telephone=$5,adresse_postale=$6
      WHERE id_client=$7 AND date_anonymisation IS NULL RETURNING id_client::text`,
          [...valeurs, id],
        )
      : await this.pool.query(
          `INSERT INTO innov_events.clients
      (entreprise,nom_contact,prenom_contact,email_contact,telephone,adresse_postale)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id_client::text`,
          valeurs,
        );
    if (!r.rows[0]) throw new ErreurHttp(409, 'Client absent ou déjà anonymisé.');
    return r.rows[0] as { id_client: string };
  }
  /** Appelle la fonction de reference et detruit les sessions dans la meme transaction. */
  async supprimerClient(id: string) {
    return this.transactions.transaction(async (db) => {
      const c = (
        await db.query<{
          id_utilisateur: string | null;
          nom_client: string;
          email_contact: string;
        }>(
          `SELECT id_utilisateur::text,prenom_contact || ' ' || nom_contact AS nom_client,email_contact
        FROM innov_events.clients WHERE id_client=$1 AND date_anonymisation IS NULL FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!c) throw new ErreurHttp(404, 'Client introuvable.');
      if (c.id_utilisateur) await this.detruireSessions(db, c.id_utilisateur);
      await db.query(
        `DELETE FROM innov_events.prospects WHERE id_client IS NULL AND LOWER(email)=LOWER($1)`,
        [c.email_contact],
      );
      await db.query('SELECT innov_events.supprimer_compte_client($1)', [id]);
      return c.nom_client;
    });
  }
  private async detruireSessions(db: PoolClient, id: string) {
    await db.query(
      `DELETE FROM innov_events.sessions WHERE sess->'authentification'->>'id_utilisateur'=$1`,
      [id],
    );
  }
  /** Tri chronologique ; le filtre a venir est commun au web et au mobile. */
  async evenements(avenir = false) {
    return (
      await this.pool.query(
        `SELECT ${EVENEMENT} FROM innov_events.evenements e
      JOIN innov_events.clients c USING(id_client)
      WHERE NOT $1::boolean OR (e.date_debut>=NOW() AND e.statut_evenement IN ('brouillon','accepte','en_cours'))
      ORDER BY e.date_debut,e.id_evenement`,
        [avenir],
      )
    ).rows;
  }
  /** Fiche complete, notes et taches partagees. */
  async evenement(id: string) {
    const e = (
      await this.pool.query(
        `SELECT ${EVENEMENT} FROM innov_events.evenements e
      JOIN innov_events.clients c USING(id_client) WHERE e.id_evenement=$1`,
        [id],
      )
    ).rows[0];
    if (!e) throw new ErreurHttp(404, 'Événement introuvable.');
    return { ...e, notes: await this.notes(id), taches: await this.taches(id) };
  }
  /** Verrouille le statut avant de verifier et d'appliquer sa transition. */
  async modifierEvenement(
    id: string,
    d: EvenementModification,
    verifier: (ancien: string, nouveau: string) => void,
  ) {
    return this.transactions.transaction(async (db) => {
      const e = (
        await db.query<{ statut_evenement: string }>(
          'SELECT statut_evenement FROM innov_events.evenements WHERE id_evenement=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!e) throw new ErreurHttp(404, 'Événement introuvable.');
      verifier(e.statut_evenement, d.statut_evenement);
      await db.query(
        `UPDATE innov_events.evenements SET nom=$2,id_type_evenement=$3,id_theme=$4,date_debut=$5,
        date_fin=$6,lieu=$7,statut_evenement=$8,image_url=$9,visible_public=$10 WHERE id_evenement=$1`,
        [
          id,
          d.nom,
          d.id_type_evenement,
          d.id_theme,
          d.date_debut,
          d.date_fin,
          d.lieu,
          d.statut_evenement,
          d.image_url,
          d.visible_public,
        ],
      );
      return e.statut_evenement;
    });
  }
  /** Un devis interdit toujours la suppression, quel que soit son statut. */
  async supprimerEvenement(id: string) {
    await this.transactions.transaction(async (db) => {
      if (
        !(
          await db.query(
            'SELECT id_evenement FROM innov_events.evenements WHERE id_evenement=$1 FOR UPDATE',
            [id],
          )
        ).rowCount
      )
        throw new ErreurHttp(404, 'Événement introuvable.');
      if ((await db.query('SELECT 1 FROM innov_events.devis WHERE id_evenement=$1', [id])).rowCount)
        throw new ErreurHttp(409, 'Un événement avec devis doit être annulé.');
      await db.query('DELETE FROM innov_events.evenements WHERE id_evenement=$1', [id]);
    });
  }
  /** Notes centrales visibles immediatement apres leur enregistrement. */
  async notes(id: string | null) {
    return (
      await this.pool.query(
        `SELECT n.id_note::text,n.id_evenement::text,n.id_utilisateur::text,
      n.contenu,to_json(n.date_creation)#>>'{}' AS date_creation,to_json(n.date_modification)#>>'{}' AS date_modification,u.prenom,u.nom
      FROM innov_events.notes n JOIN innov_events.utilisateurs u USING(id_utilisateur)
      WHERE n.id_evenement IS NOT DISTINCT FROM $1::bigint ORDER BY n.date_creation DESC,n.id_note DESC`,
        [id],
      )
    ).rows;
  }
  /** Les droits sur une note sont verifies sous verrou. */
  async enregistrerNote(
    id: string | null,
    evenement: string | null,
    contenu: string,
    acteur: string,
    admin: boolean,
    suppression = false,
  ) {
    return this.transactions.transaction(async (db) => {
      if (!id) {
        if (!evenement && !admin)
          throw new ErreurHttp(403, 'Note globale réservée à l’administrateur.');
        const r = await db.query(
          `INSERT INTO innov_events.notes(id_evenement,id_utilisateur,contenu)
          VALUES($1,$2,$3) RETURNING id_note::text`,
          [evenement, acteur, contenu],
        );
        return r.rows[0];
      }
      const n = (
        await db.query<{ id_utilisateur: string; id_evenement: string | null }>(
          'SELECT id_utilisateur::text,id_evenement::text FROM innov_events.notes WHERE id_note=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!n) throw new ErreurHttp(404, 'Note introuvable.');
      if (!admin && (n.id_utilisateur !== acteur || !n.id_evenement))
        throw new ErreurHttp(403, 'Seul l’auteur peut modifier cette note.');
      if (suppression) await db.query('DELETE FROM innov_events.notes WHERE id_note=$1', [id]);
      else
        await db.query(
          'UPDATE innov_events.notes SET contenu=$2,date_modification=NOW() WHERE id_note=$1',
          [id, contenu],
        );
      return { id_note: id };
    });
  }
  /** Toutes les taches du projet, avec leur affectation explicite. */
  async taches(id: string) {
    return (
      await this.pool.query(
        `SELECT t.id_tache::text,t.id_evenement::text,t.id_utilisateur::text,t.titre,
      t.description,t.statut_tache,to_json(t.date_echeance)#>>'{}' AS date_echeance,u.prenom,u.nom FROM innov_events.taches t
      JOIN innov_events.utilisateurs u USING(id_utilisateur) WHERE id_evenement=$1 ORDER BY t.date_creation,t.id_tache`,
        [id],
      )
    ).rows;
  }
  /** L'affecte doit etre un employe ou administrateur actif, verrouille contre sa suppression. */
  async creerTache(d: TacheSaisie) {
    return this.transactions.transaction(async (db) => {
      await this.verifierAffecte(db, d.id_utilisateur);
      return (
        await db.query(
          `INSERT INTO innov_events.taches(id_evenement,id_utilisateur,titre,description,date_echeance)
        VALUES($1,$2,$3,$4,$5) RETURNING id_tache::text`,
          [d.id_evenement, d.id_utilisateur, d.titre, d.description, d.date_echeance],
        )
      ).rows[0];
    });
  }
  private async verifierAffecte(db: PoolClient, id: string) {
    if (
      !(
        await db.query(
          `SELECT 1 FROM innov_events.utilisateurs WHERE id_utilisateur=$1
      AND role IN ('employe','admin') AND statut_compte='actif' FOR UPDATE`,
          [id],
        )
      ).rowCount
    )
      throw new ErreurHttp(409, 'Affectation à un employé ou administrateur actif requise.');
  }
  /** Une reaffectation ne change jamais le statut. */
  async affecterTache(id: string, affecte: string) {
    await this.transactions.transaction(async (db) => {
      await this.verifierAffecte(db, affecte);
      const r = await db.query(
        `UPDATE innov_events.taches SET id_utilisateur=$2 WHERE id_tache=$1
        AND statut_tache<>'termine' RETURNING id_tache`,
        [id, affecte],
      );
      if (!r.rowCount) throw new ErreurHttp(409, 'Tâche absente ou terminée.');
    });
  }
  /** Meme l'administrateur ne change que le statut de ses propres taches. */
  async statutTache(
    id: string,
    acteur: string,
    nouveau: string,
    verifier: (a: string, b: string) => void,
  ) {
    await this.transactions.transaction(async (db) => {
      const t = (
        await db.query<{ id_utilisateur: string; statut_tache: string }>(
          'SELECT id_utilisateur::text,statut_tache FROM innov_events.taches WHERE id_tache=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!t) throw new ErreurHttp(404, 'Tâche introuvable.');
      if (t.id_utilisateur !== acteur)
        throw new ErreurHttp(403, 'Seul l’affecté peut modifier le statut.');
      verifier(t.statut_tache, nouveau);
      await db.query('UPDATE innov_events.taches SET statut_tache=$2 WHERE id_tache=$1', [
        id,
        nouveau,
      ]);
    });
  }
  /** Comptes sans haches ; la liste sert aussi a l'affectation des taches. */
  async comptes() {
    return (
      await this.pool
        .query(`SELECT u.id_utilisateur::text,u.email_connexion,u.nom_utilisateur,u.prenom,u.nom,
      u.role,u.statut_compte,c.id_client::text FROM innov_events.utilisateurs u
      LEFT JOIN innov_events.clients c USING(id_utilisateur) ORDER BY u.nom,u.prenom,u.id_utilisateur`)
    ).rows;
  }
  /** Interdit toute creation d'administrateur par HTTP. */
  async creerCompte(d: CompteSaisie, hache: string, envoyer: () => Promise<void>) {
    return this.transactions.transaction(async (db) => {
      const u = (
        await db.query<{ id_utilisateur: string }>(
          `INSERT INTO innov_events.utilisateurs
        (email_connexion,nom_utilisateur,prenom,nom,role,mdp_temporaire_hache,mdp_temporaire_expire_le) VALUES($1,$2,$3,$4,$5,$6,clock_timestamp()+INTERVAL '7 days')
        RETURNING id_utilisateur::text`,
          [d.email_connexion, d.nom_utilisateur, d.prenom, d.nom, d.role, hache],
        )
      ).rows[0]!;
      if (d.id_client) {
        const c = await db.query(
          `UPDATE innov_events.clients SET id_utilisateur=$2 WHERE id_client=$1
          AND id_utilisateur IS NULL AND date_anonymisation IS NULL RETURNING id_client`,
          [d.id_client, u.id_utilisateur],
        );
        if (!c.rowCount) throw new ErreurHttp(409, 'Fiche client absente ou déjà rattachée.');
      }
      await envoyer();
      return u;
    });
  }
  /** Suspend/reprend les comptes et retire physiquement toutes leurs sessions. */
  async statutCompte(id: string, statut: string) {
    await this.transactions.transaction(async (db) => {
      const u = (
        await db.query<{ role: string; statut_compte: string }>(
          'SELECT role,statut_compte FROM innov_events.utilisateurs WHERE id_utilisateur=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!u) throw new ErreurHttp(404, 'Compte introuvable.');
      if (u.role === 'admin' || u.statut_compte === 'supprime')
        throw new ErreurHttp(409, 'Ce compte ne peut pas être modifié.');
      await db.query(
        'UPDATE innov_events.utilisateurs SET statut_compte=$2 WHERE id_utilisateur=$1',
        [id, statut],
      );
      if (statut === 'suspendu') await this.detruireSessions(db, id);
    });
  }
  /** Supprime un employe logiquement ; un client rattache suit le parcours de sa fiche. */
  async supprimerCompte(id: string, acteur: string) {
    const u = (
      await this.pool.query<{ role: string; id_client: string | null }>(
        `SELECT u.role,c.id_client::text
      FROM innov_events.utilisateurs u LEFT JOIN innov_events.clients c USING(id_utilisateur) WHERE u.id_utilisateur=$1`,
        [id],
      )
    ).rows[0];
    if (!u) throw new ErreurHttp(404, 'Compte introuvable.');
    if (u.role === 'admin') throw new ErreurHttp(409, 'Le compte administrateur est protégé.');
    if (u.role === 'client' && u.id_client)
      return { id_client: u.id_client, nom_client: await this.supprimerClient(u.id_client) };
    await this.transactions.transaction(async (db) => {
      await db.query(
        'SELECT id_utilisateur FROM innov_events.utilisateurs WHERE id_utilisateur=$1 FOR UPDATE',
        [id],
      );
      await this.detruireSessions(db, id);
      if (u.role === 'employe') {
        await db.query(
          `UPDATE innov_events.taches SET id_utilisateur=$2 WHERE id_utilisateur=$1 AND statut_tache<>'termine'`,
          [id, acteur],
        );
        await db.query('SELECT innov_events.supprimer_compte_employe($1)', [id]);
      } else {
        await db.query(
          `DELETE FROM innov_events.prospects WHERE id_client IS NULL AND LOWER(email)=
          (SELECT LOWER(email_connexion) FROM innov_events.utilisateurs WHERE id_utilisateur=$1)`,
          [id],
        );
        await db.query('DELETE FROM innov_events.utilisateurs WHERE id_utilisateur=$1', [id]);
      }
    });
    return null;
  }
  /** Avis moderables et projection publique limitee aux avis valides. */
  async avis(publics = false) {
    return (
      await this.pool.query(
        `SELECT a.id_avis::text,a.id_evenement::text,a.commentaire,a.note_evaluation,
      a.statut_avis,to_json(a.date_creation)#>>'{}' AS date_creation,e.nom AS evenement FROM innov_events.avis a
      JOIN innov_events.evenements e USING(id_evenement) WHERE NOT $1::boolean OR a.statut_avis='valide'
      ORDER BY a.date_creation DESC,a.id_avis DESC`,
        [publics],
      )
    ).rows;
  }
  /** La moderation est une transition terminale. */
  async moderer(id: string, statut: string) {
    if (
      !(
        await this.pool.query(
          `UPDATE innov_events.avis SET statut_avis=$2
      WHERE id_avis=$1 AND statut_avis='en_attente' RETURNING id_avis`,
          [id, statut],
        )
      ).rowCount
    )
      throw new ErreurHttp(409, 'Avis absent ou déjà modéré.');
  }
  /** Prochains evenements, notes recentes, clients actifs et brouillons. */
  async tableauDeBord() {
    const [prochains, notes, actifs, brouillons] = await Promise.all([
      this.pool
        .query(`SELECT e.id_evenement::text,e.nom,to_json(e.date_debut)#>>'{}' AS date_debut,c.entreprise,
        c.prenom_contact,c.nom_contact FROM innov_events.evenements e JOIN innov_events.clients c USING(id_client)
        WHERE e.date_debut>=NOW() AND e.statut_evenement NOT IN ('annule','termine') ORDER BY e.date_debut,e.id_evenement LIMIT 3`),
      this.pool
        .query(`SELECT n.id_note::text,n.id_evenement::text,n.contenu,to_json(n.date_creation)#>>'{}' AS date_creation,u.prenom,u.nom
        FROM innov_events.notes n JOIN innov_events.utilisateurs u USING(id_utilisateur) ORDER BY n.date_creation DESC,n.id_note DESC LIMIT 5`),
      this.pool
        .query(`SELECT ${CLIENT} FROM innov_events.clients c WHERE c.date_anonymisation IS NULL
        AND EXISTS(SELECT 1 FROM innov_events.evenements e WHERE e.id_client=c.id_client AND e.statut_evenement='en_cours') ORDER BY c.entreprise`),
      this.pool.query(`SELECT e.id_evenement::text,e.nom,c.entreprise FROM innov_events.evenements e
        JOIN innov_events.clients c USING(id_client) WHERE e.statut_evenement='brouillon' ORDER BY e.date_debut`),
    ]);
    return {
      prochains_evenements: prochains.rows,
      notes_recentes: notes.rows,
      clients_actifs: actifs.rows,
      brouillons: brouillons.rows,
    };
  }
}
