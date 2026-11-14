import type { Pool } from 'pg';

export type Role = 'admin' | 'employe' | 'client';
export interface Utilisateur {
  id_utilisateur: string;
  email_connexion: string;
  nom_utilisateur: string;
  prenom: string;
  nom: string;
  role: Role;
  statut_compte: string;
  mot_de_passe_hache: string | null;
  mdp_temporaire_hache: string | null;
  mdp_temporaire_expire_le: string | null;
}
export type Inscription = Pick<
  Utilisateur,
  'email_connexion' | 'nom_utilisateur' | 'prenom' | 'nom'
>;
const COLONNES = `id_utilisateur::text, email_connexion, nom_utilisateur, prenom, nom, role,
  statut_compte, mot_de_passe_hache, mdp_temporaire_hache, mdp_temporaire_expire_le::text`;

/** Centralise les requetes parametrees sur les comptes. */
export class UtilisateursRepository {
  constructor(private readonly postgres: Pool) {}

  /** Recherche privee : aucun hache n'est expose par le controleur. */
  async parEmail(email: string): Promise<Utilisateur | undefined> {
    return (
      await this.postgres.query<Utilisateur>(
        `SELECT ${COLONNES} FROM innov_events.utilisateurs WHERE LOWER(email_connexion) = LOWER($1)`,
        [email],
      )
    ).rows[0];
  }

  /** Recharge le role et le statut a chaque requete protegee. */
  async parId(id: string): Promise<Utilisateur | undefined> {
    return (
      await this.postgres.query<Utilisateur>(
        `SELECT ${COLONNES} FROM innov_events.utilisateurs WHERE id_utilisateur = $1`,
        [id],
      )
    ).rows[0];
  }

  /** Une inscription publique produit exclusivement un compte client. */
  async inscrire(donnees: Inscription, hache: string): Promise<boolean> {
    const resultat = await this.postgres.query(
      `INSERT INTO innov_events.utilisateurs
      (email_connexion, nom_utilisateur, prenom, nom, mot_de_passe_hache, role)
      VALUES ($1, $2, $3, $4, $5, 'client') ON CONFLICT DO NOTHING RETURNING id_utilisateur`,
      [donnees.email_connexion, donnees.nom_utilisateur, donnees.prenom, donnees.nom, hache],
    );
    return resultat.rowCount === 1;
  }

  /** Le mot de passe choisi par le titulaire reste utilisable. */
  async preparerOubli(id: string, hache: string): Promise<boolean> {
    const resultat = await this.postgres.query(
      `UPDATE innov_events.utilisateurs SET
      mdp_temporaire_hache = $2, mdp_temporaire_expire_le = clock_timestamp() + INTERVAL '1 hour'
      WHERE id_utilisateur = $1 AND statut_compte = 'actif' RETURNING id_utilisateur`,
      [id, hache],
    );
    return resultat.rowCount === 1;
  }

  /** Une seule requete concurrente peut consommer le hache encore valide. */
  async consommerTemporaire(id: string, hache: string): Promise<string | undefined> {
    const resultat = await this.postgres.query<{ mdp_temporaire_expire_le: string }>(
      `UPDATE innov_events.utilisateurs
      SET mdp_temporaire_expire_le = clock_timestamp()
      WHERE id_utilisateur = $1 AND mdp_temporaire_hache = $2
        AND mdp_temporaire_expire_le > clock_timestamp() AND statut_compte = 'actif'
      RETURNING mdp_temporaire_expire_le::text`,
      [id, hache],
    );
    return resultat.rows[0]?.mdp_temporaire_expire_le;
  }

  /** Compare aussi la consommation : une session ancienne ne remplace pas un nouveau mot de passe. */
  async changerMotDePasse(
    id: string,
    hacheTemporaire: string,
    consommation: string,
    nouveauHache: string,
  ): Promise<boolean> {
    const resultat = await this.postgres.query(
      `UPDATE innov_events.utilisateurs SET
      mot_de_passe_hache = $4, mdp_temporaire_hache = NULL, mdp_temporaire_expire_le = NULL
      WHERE id_utilisateur = $1 AND mdp_temporaire_hache = $2
        AND mdp_temporaire_expire_le = $3::timestamptz AND statut_compte = 'actif'
      RETURNING id_utilisateur`,
      [id, hacheTemporaire, consommation, nouveauHache],
    );
    return resultat.rowCount === 1;
  }

  /** Appele exclusivement par le script, avec verrou pour garantir un seul administrateur. */
  async creerAdmin(donnees: Inscription, hache: string): Promise<void> {
    const client = await this.postgres.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(157001)');
      if (
        (await client.query("SELECT 1 FROM innov_events.utilisateurs WHERE role = 'admin'"))
          .rowCount
      ) {
        throw new Error('Un administrateur existe déjà.');
      }
      await client.query(
        `INSERT INTO innov_events.utilisateurs
        (email_connexion, nom_utilisateur, prenom, nom, mot_de_passe_hache, role)
        VALUES ($1, $2, $3, $4, $5, 'admin')`,
        [donnees.email_connexion, donnees.nom_utilisateur, donnees.prenom, donnees.nom, hache],
      );
      await client.query('COMMIT');
    } catch (erreur) {
      await client.query('ROLLBACK');
      throw erreur;
    } finally {
      client.release();
    }
  }
}
