import { LIBELLES_STATUT } from './statuts';

export interface Note {
  id_note: string;
  id_utilisateur: string;
  id_evenement: string | null;
  contenu: string;
  prenom: string;
  nom: string;
  date_creation: string;
}
export interface Tache {
  id_tache: string;
  id_utilisateur: string;
  id_evenement: string;
  titre: string;
  description: string | null;
  statut_tache: string;
  date_echeance: string | null;
  prenom: string;
  nom: string;
}
export interface Client {
  id_client: string;
  id_utilisateur: string | null;
  entreprise: string | null;
  nom_contact: string | null;
  prenom_contact: string | null;
  email_contact: string | null;
  telephone: string | null;
  adresse_postale: string | null;
  date_anonymisation: string | null;
  evenements?: Evenement[];
}
export interface Evenement {
  id_evenement: string;
  id_client: string;
  id_prospect: string | null;
  id_type_evenement: number;
  id_theme: number | null;
  nom: string;
  date_debut: string;
  date_fin: string;
  lieu: string;
  statut_evenement: string;
  image_url: string | null;
  visible_public: boolean;
  date_accord_publication: string | null;
  entreprise: string | null;
  notes: Note[];
  taches: Tache[];
}
export interface Compte {
  id_utilisateur: string;
  email_connexion: string;
  nom_utilisateur: string;
  prenom: string;
  nom: string;
  role: string;
  statut_compte: string;
  id_client: string | null;
}
/** Libelles communs (statuts et roles) sans transformer les valeurs du contrat API. */
export const LIBELLES: Record<string, string> = {
  ...LIBELLES_STATUT,
  admin: 'Administrateur',
  employe: 'Employé',
  client: 'Client',
};
