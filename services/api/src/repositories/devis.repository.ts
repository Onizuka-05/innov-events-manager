import type { Pool, PoolClient } from 'pg';
import { ErreurHttp } from '../http/erreur-http.js';

/** Statuts d'evenement qui ferment l'envoi et l'acceptation des devis. */
const EVENEMENT_CLOS = ['annule', 'termine'];

/**
 * Compte de la session, dans la meme instruction que le controle de propriete : le compte n'est
 * retenu que s'il est actif et si son mot de passe est encore celui qui a autorise la session.
 * Le rattachement d'un compte a une fiche, a l'envoi du premier devis, remplace ce mot de passe :
 * une requete autorisee juste avant ne voit donc ni la fiche, ni ses evenements, ni ses devis.
 * Parametres : position de l'identifiant du compte, puis du hache de la session.
 */
export function compteSession(idCompte: number, hache: number): string {
  return `(SELECT s.id_utilisateur FROM innov_events.utilisateurs s WHERE s.id_utilisateur=$${idCompte}
    AND s.mot_de_passe_hache=$${hache} AND s.statut_compte='actif')`;
}

/**
 * A appeler apres le verrou de l'evenement : le rattachement d'un compte a l'envoi du premier
 * devis remplace son mot de passe sous ce meme verrou. Une requete d'un client deja autorisee
 * par l'ancien mot de passe, et qui attendait ce verrou, est donc refusee (401) au lieu d'agir
 * sur une fiche qui vient de lui etre rattachee. Lecture simple, sans verrou du compte : l'ordre
 * des verrous (fiche, evenement, devis, puis compte a l'envoi) reste inchange.
 */
async function verifierSessionApresVerrou(
  db: PoolClient,
  idUtilisateur: string,
  hacheSession: string,
): Promise<void> {
  const u = (
    await db.query<{ mot_de_passe_hache: string | null; statut_compte: string }>(
      'SELECT mot_de_passe_hache,statut_compte FROM innov_events.utilisateurs WHERE id_utilisateur=$1',
      [idUtilisateur],
    )
  ).rows[0];
  if (!u || u.statut_compte !== 'actif' || u.mot_de_passe_hache !== hacheSession)
    throw new ErreurHttp(401, 'Session invalide.');
}

export interface LigneDevis {
  libelle_prestation: string;
  montant_ht: number;
}
export interface EvenementSaisie {
  id_client: string;
  id_prospect: string | null;
  id_type_evenement: number;
  id_theme: number | null;
  nom: string;
  date_debut: string;
  date_fin: string;
  lieu: string;
  statut_evenement: 'brouillon' | 'accepte';
  image_url: string | null;
  visible_public: boolean;
}
export interface DevisDetail {
  id_devis: string;
  id_evenement: string;
  intitule: string;
  statut_devis: string;
  taux_tva_applique: string;
  date_envoi: string | null;
  motif_modification: string | null;
  id_client: string;
  email_contact: string | null;
  nom_contact: string | null;
  lignes: {
    id_ligne_devis: string;
    libelle_prestation: string;
    montant_ht: string;
    ordre_affichage: number;
  }[];
}

/** Regroupe les transactions du parcours devis, avec verrouillage concurrent. */
export class DevisRepository {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resultat = await operation(client);
      await client.query('COMMIT');
      return resultat;
    } catch (erreur) {
      await client.query('ROLLBACK');
      throw erreur;
    } finally {
      client.release();
    }
  }

  /**
   * Conversion atomique : verrouille le prospect, puis rattache la demande a la fiche existante
   * du meme e-mail (client qui revient) ou cree une nouvelle fiche. L'e-mail d'une demande n'est
   * jamais verifie : le rattachement a une fiche existante exige que l'administratrice ait
   * confirme cette fiche precise (idClientConfirme), et une confirmation devenue sans objet est
   * refusee plutot que transformee en creation.
   */
  async convertir(
    id: string,
    adresse: string,
    idClientConfirme: string | null = null,
  ): Promise<{ id_client: string; nom_client: string; cree: boolean }> {
    return this.transaction(async (db) => {
      const resultat = await db.query<{
        id_client: string | null;
        statut_prospect: string;
        entreprise: string;
        nom: string;
        prenom: string;
        email: string;
        telephone: string;
        id_type_evenement: number;
        lieu_souhaite: string;
        date_souhaitee: string;
      }>(
        `SELECT id_client::text, statut_prospect, entreprise, nom, prenom, email, telephone,
         id_type_evenement, lieu_souhaite, date_souhaitee::text
         FROM innov_events.prospects WHERE id_prospect = $1 FOR UPDATE`,
        [id],
      );
      const p = resultat.rows[0];
      if (!p || p.id_client || p.statut_prospect !== 'a_contacter')
        throw new ErreurHttp(409, 'La demande est absente ou déjà convertie.');
      // Deux demandes du meme e-mail converties en meme temps ne creent pas deux fiches.
      await db.query('SELECT pg_advisory_xact_lock(hashtext(LOWER($1)))', [p.email]);
      const existantes = await db.query<{
        id_client: string;
        nom_client: string;
        entreprise: string | null;
      }>(
        `SELECT id_client::text, prenom_contact || ' ' || nom_contact AS nom_client, entreprise
        FROM innov_events.clients
        WHERE LOWER(email_contact)=LOWER($1) AND date_anonymisation IS NULL
        ORDER BY id_client FOR UPDATE`,
        [p.email],
      );
      // Plusieurs fiches pour une meme adresse : le rattachement ne doit pas etre devine.
      if (existantes.rows.length > 1)
        throw new ErreurHttp(
          409,
          'Plusieurs fiches clients portent l’adresse de cette demande : corrigez le doublon dans « Clients » avant de convertir.',
          'FICHES_EN_DOUBLE',
        );
      const existante = existantes.rows[0];
      // Exemple : la demande d'Alpha, conservee a son effacement parce que Beta partageait son
      // adresse, ne rejoint pas Beta du seul fait que Beta est devenue l'unique fiche active.
      if ((existante?.id_client ?? null) !== idClientConfirme)
        throw new ErreurHttp(
          409,
          existante
            ? `Une fiche client porte déjà l’adresse de cette demande (${existante.entreprise ?? existante.nom_client}) : vérifiez qu’il s’agit de la même entreprise, puis confirmez le rattachement.`
            : 'La fiche à laquelle rattacher la demande a changé : rechargez la page.',
          'RATTACHEMENT_A_CONFIRMER',
        );
      let fiche = existante && { id_client: existante.id_client, nom_client: existante.nom_client };
      const cree = !fiche;
      if (!fiche) {
        const insertion = await db.query<{ id_client: string }>(
          `INSERT INTO innov_events.clients
          (entreprise, nom_contact, prenom_contact, email_contact, telephone, adresse_postale)
          VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_client::text`,
          [p.entreprise, p.nom, p.prenom, p.email, p.telephone, adresse],
        );
        fiche = { id_client: insertion.rows[0]!.id_client, nom_client: `${p.prenom} ${p.nom}` };
      }
      await db.query(
        `UPDATE innov_events.prospects SET id_client=$2, statut_prospect='converti', date_dernier_contact=NOW()
        WHERE id_prospect=$1`,
        [id, fiche.id_client],
      );
      return { ...fiche, cree };
    });
  }

  /** Classement sans suite : le message part avant le COMMIT ; un echec d'envoi annule tout. */
  async echouer(
    id: string,
    notifier: (p: { email: string; nom: string; prenom: string }) => Promise<void>,
  ): Promise<{ email: string; nom: string; prenom: string }> {
    return this.transaction(async (db) => {
      const r = await db.query<{ email: string; nom: string; prenom: string }>(
        `UPDATE innov_events.prospects
        SET statut_prospect='echoue', date_dernier_contact=NOW()
        WHERE id_prospect=$1 AND statut_prospect='a_contacter' RETURNING email,nom,prenom`,
        [id],
      );
      if (!r.rows[0]) throw new ErreurHttp(409, 'Demande non modifiable.');
      await notifier(r.rows[0]);
      return r.rows[0];
    });
  }
  async clients() {
    return (
      await this.pool.query(`SELECT id_client::text, entreprise, nom_contact, prenom_contact,
      email_contact, adresse_postale FROM innov_events.clients WHERE date_anonymisation IS NULL ORDER BY id_client DESC LIMIT 100`)
    ).rows;
  }
  async prospects() {
    return (
      await this.pool
        .query(`SELECT id_prospect::text, entreprise, nom, prenom, email, telephone, statut_prospect,
      date_souhaitee::text, id_type_evenement, lieu_souhaite, id_client::text FROM innov_events.prospects ORDER BY date_demande DESC LIMIT 100`)
    ).rows;
  }
  async themes() {
    return (
      await this.pool.query('SELECT id_theme, libelle FROM innov_events.themes ORDER BY libelle')
    ).rows;
  }
  async evenements() {
    return (
      await this.pool.query(`SELECT id_evenement::text, id_client::text, nom, statut_evenement
    FROM innov_events.evenements ORDER BY date_debut DESC LIMIT 100`)
    ).rows;
  }

  async creerEvenement(d: EvenementSaisie): Promise<string> {
    return this.transaction(async (db) => {
      if (
        !(
          await db.query(
            `SELECT 1 FROM innov_events.clients WHERE id_client=$1 AND date_anonymisation IS NULL FOR UPDATE`,
            [d.id_client],
          )
        ).rowCount
      )
        throw new ErreurHttp(409, 'Client absent ou anonymisé.');
      if (d.id_prospect) {
        const r = await db.query<{ id_client: string }>(
          `SELECT id_client::text FROM innov_events.prospects
          WHERE id_prospect=$1 AND statut_prospect='converti' FOR UPDATE`,
          [d.id_prospect],
        );
        if (!r.rows[0] || r.rows[0].id_client !== d.id_client)
          throw new ErreurHttp(409, 'La demande et le client ne correspondent pas.');
      }
      const r = await db.query<{ id_evenement: string }>(
        `INSERT INTO innov_events.evenements
        (id_client,id_prospect,id_type_evenement,id_theme,nom,date_debut,date_fin,lieu,statut_evenement,image_url,visible_public)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id_evenement::text`,
        [
          d.id_client,
          d.id_prospect,
          d.id_type_evenement,
          d.id_theme,
          d.nom,
          d.date_debut,
          d.date_fin,
          d.lieu,
          d.statut_evenement,
          d.image_url,
          d.visible_public,
        ],
      );
      return r.rows[0]!.id_evenement;
    });
  }
  async creerDevis(idEvenement: string, intitule: string): Promise<string> {
    const r = await this.pool.query<{ id_devis: string }>(
      `INSERT INTO innov_events.devis
      (id_evenement,intitule,taux_tva_applique)
      SELECT $1,$2,taux_tva_defaut FROM innov_events.parametres WHERE id_parametres=1
      RETURNING id_devis::text`,
      [idEvenement, intitule],
    );
    if (!r.rows[0]) throw new ErreurHttp(503, 'Paramètres de TVA indisponibles.');
    return r.rows[0].id_devis;
  }
  async liste(idUtilisateur: string, role: string, hacheSession: string | null = null) {
    const client = role === 'client';
    return (
      await this.pool.query(
        `SELECT d.id_devis::text,d.id_evenement::text,d.intitule,d.statut_devis,
       e.nom AS evenement, c.entreprise, d.date_envoi
       FROM innov_events.devis d JOIN innov_events.evenements e ON e.id_evenement=d.id_evenement
       JOIN innov_events.clients c ON c.id_client=e.id_client
       WHERE ($1::boolean = FALSE OR (c.id_utilisateur=${compteSession(2, 3)} AND d.date_envoi IS NOT NULL))
       ORDER BY d.date_creation DESC LIMIT 200`,
        [client, idUtilisateur, hacheSession],
      )
    ).rows;
  }
  async detail(
    id: string,
    db: PoolClient = this.pool as unknown as PoolClient,
    verrou = false,
  ): Promise<DevisDetail> {
    const r = await db.query<Omit<DevisDetail, 'lignes'>>(
      `SELECT d.id_devis::text,d.id_evenement::text,d.intitule,d.statut_devis,
      d.taux_tva_applique::text,d.date_envoi::text,d.motif_modification,c.id_client::text,c.email_contact,c.nom_contact
      FROM innov_events.devis d JOIN innov_events.evenements e ON e.id_evenement=d.id_evenement
      JOIN innov_events.clients c ON c.id_client=e.id_client WHERE d.id_devis=$1 ${verrou ? 'FOR UPDATE OF d' : ''}`,
      [id],
    );
    if (!r.rows[0]) throw new ErreurHttp(404, 'Devis introuvable.');
    const lignes = await db.query<DevisDetail['lignes'][number]>(
      `SELECT id_ligne_devis::text,libelle_prestation,montant_ht::text,ordre_affichage
      FROM innov_events.lignes_devis WHERE id_devis=$1 ORDER BY ordre_affichage`,
      [id],
    );
    return { ...r.rows[0], lignes: lignes.rows };
  }
  async possede(id: string, utilisateur: string, hacheSession: string): Promise<boolean> {
    const r = await this.pool.query(
      `SELECT 1 FROM innov_events.devis d JOIN innov_events.evenements e USING (id_evenement)
       JOIN innov_events.clients c USING (id_client)
       WHERE d.id_devis=$1 AND c.id_utilisateur=${compteSession(2, 3)} AND d.date_envoi IS NOT NULL`,
      [id, utilisateur, hacheSession],
    );
    return r.rowCount === 1;
  }
  async remplacerLignes(id: string, lignes: LigneDevis[]): Promise<void> {
    await this.transaction(async (db) => {
      const d = await this.detail(id, db, true);
      if (!['en_preparation', 'modification'].includes(d.statut_devis))
        throw new ErreurHttp(409, 'Ce devis ne peut plus être modifié.');
      await db.query('DELETE FROM innov_events.lignes_devis WHERE id_devis=$1', [id]);
      for (const [index, l] of lignes.entries())
        await db.query(
          `INSERT INTO innov_events.lignes_devis
        (id_devis,libelle_prestation,montant_ht,ordre_affichage) VALUES ($1,$2,$3,$4)`,
          [id, l.libelle_prestation, l.montant_ht, index + 1],
        );
    });
  }
  async modifierDevis(id: string, intitule: string): Promise<void> {
    const r = await this.pool.query(
      `UPDATE innov_events.devis SET intitule=$2 WHERE id_devis=$1
      AND statut_devis IN ('en_preparation','modification')`,
      [id, intitule],
    );
    if (!r.rowCount) throw new ErreurHttp(409, 'Devis non modifiable.');
  }
  /**
   * Verrouille l'evenement du devis avant le devis lui-meme et renvoie son statut. L'annulation
   * de l'evenement modifie la meme ligne : elle precede ou suit l'envoi et la reponse.
   * Ordre des verrous commun a toute l'API : fiche client, puis evenement, puis devis. La
   * suppression d'une fiche verrouille la fiche, puis l'evenement (cle id_prospect remise a
   * NULL) : l'envoi, qui verrouille aussi la fiche, la prend donc en premier (avecFiche).
   */
  private async verrouillerEvenement(
    id: string,
    db: PoolClient,
    avecFiche = false,
  ): Promise<string> {
    if (avecFiche) {
      // Le client d'un evenement ne change jamais : il peut etre lu avant tout verrou.
      const fiche = await db.query<{ id_client: string }>(
        `SELECT e.id_client::text FROM innov_events.evenements e
        JOIN innov_events.devis d ON d.id_evenement=e.id_evenement WHERE d.id_devis=$1`,
        [id],
      );
      if (!fiche.rows[0]) throw new ErreurHttp(404, 'Devis introuvable.');
      await db.query('SELECT 1 FROM innov_events.clients WHERE id_client=$1 FOR UPDATE', [
        fiche.rows[0].id_client,
      ]);
    }
    const r = await db.query<{ statut_evenement: string }>(
      `SELECT e.statut_evenement FROM innov_events.evenements e
      JOIN innov_events.devis d ON d.id_evenement=e.id_evenement
      WHERE d.id_devis=$1 FOR UPDATE OF e`,
      [id],
    );
    if (!r.rows[0]) throw new ErreurHttp(404, 'Devis introuvable.');
    return r.rows[0].statut_evenement;
  }
  /** Envoi reserve aux statuts attendus, transaction sous verrou, jamais sans lignes. */
  async preparerEnvoi(
    id: string,
    operation: (db: PoolClient, d: DevisDetail) => Promise<void>,
  ): Promise<DevisDetail> {
    return this.transaction(async (db) => {
      const statutEvenement = await this.verrouillerEvenement(id, db, true);
      const d = await this.detail(id, db, true);
      if (!['en_preparation', 'modification'].includes(d.statut_devis) || d.lignes.length === 0)
        throw new ErreurHttp(409, 'Le devis doit contenir une prestation et être prêt pour envoi.');
      if (EVENEMENT_CLOS.includes(statutEvenement))
        throw new ErreurHttp(
          409,
          'L’événement est annulé ou terminé : ce devis ne peut plus être envoyé.',
        );
      await operation(db, d);
      await db.query(
        `UPDATE innov_events.devis SET statut_devis='etude_client',date_envoi=NOW()
        WHERE id_devis=$1`,
        [id],
      );
      return { ...d, statut_devis: 'etude_client' };
    });
  }
  async repondre(
    id: string,
    idUtilisateur: string,
    hacheSession: string,
    choix: 'accepte' | 'refuse' | 'modification',
    motif: string,
  ): Promise<boolean> {
    return this.transaction(async (db) => {
      const statutEvenement = await this.verrouillerEvenement(id, db);
      await verifierSessionApresVerrou(db, idUtilisateur, hacheSession);
      const d = await this.detail(id, db, true);
      const proprietaire = await db.query(
        `SELECT 1 FROM innov_events.evenements e JOIN innov_events.clients c USING(id_client)
        WHERE e.id_evenement=$1 AND c.id_utilisateur=$2`,
        [d.id_evenement, idUtilisateur],
      );
      if (!proprietaire.rowCount) throw new ErreurHttp(404, 'Devis introuvable.');
      if (d.statut_devis !== 'etude_client')
        throw new ErreurHttp(409, 'Ce devis ne peut pas recevoir de réponse.');
      // Un evenement annule ou termine n'accepte plus d'engagement : seul le refus reste possible.
      if (choix !== 'refuse' && EVENEMENT_CLOS.includes(statutEvenement))
        throw new ErreurHttp(
          409,
          'L’événement est annulé ou terminé : ce devis ne peut plus être accepté ni modifié.',
        );
      let evenementChange = false;
      if (choix === 'accepte') {
        // Serialise les acceptations simultanees de devis d'un même événement.
        const autre = await db.query(
          `SELECT 1 FROM innov_events.devis WHERE id_evenement=$1 AND statut_devis='accepte'`,
          [d.id_evenement],
        );
        if (autre.rowCount)
          throw new ErreurHttp(409, 'Un devis est déjà accepté pour cet événement.');
        await db.query(
          `UPDATE innov_events.devis SET statut_devis='refuse' WHERE id_evenement=$1 AND id_devis<>$2
          AND statut_devis IN ('en_preparation','etude_client','modification')`,
          [d.id_evenement, id],
        );
        const modif = await db.query(
          `UPDATE innov_events.evenements SET statut_evenement='accepte' WHERE id_evenement=$1 AND statut_evenement='brouillon'`,
          [d.id_evenement],
        );
        evenementChange = modif.rowCount === 1;
      }
      await db.query(
        `UPDATE innov_events.devis SET statut_devis=$2::text,
        motif_modification=CASE WHEN $2::text='modification' THEN $3 ELSE motif_modification END,
        date_modification=CASE WHEN $2::text='modification' THEN NOW() ELSE date_modification END WHERE id_devis=$1`,
        [id, choix, motif],
      );
      return evenementChange;
    });
  }
}
