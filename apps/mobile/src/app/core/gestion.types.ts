/** Evenement tel que renvoye par GET /api/evenements et GET /api/evenements/:id. */
export interface Evenement {
  id_evenement: string;
  id_client: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  lieu: string;
  statut_evenement: string;
  entreprise: string | null;
}

/** Note partagee d'un evenement (auteur, contenu, dates ISO). */
export interface Note {
  id_note: string;
  contenu: string;
  date_creation: string;
  prenom: string;
  nom: string;
}

/** Fiche complete d'un evenement : notes les plus recentes en premier. */
export interface FicheEvenement extends Evenement {
  notes: Note[];
}

/** Fiche client renvoyee par GET /api/clients/:id ; coordonnees nulles une fois anonymisee. */
export interface FicheClient {
  id_client: string;
  entreprise: string | null;
  nom_contact: string | null;
  prenom_contact: string | null;
  email_contact: string | null;
  telephone: string | null;
  adresse_postale: string | null;
  date_anonymisation: string | null;
}
