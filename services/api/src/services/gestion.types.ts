export interface ClientSaisie {
  entreprise: string;
  nom_contact: string;
  prenom_contact: string;
  email_contact: string;
  telephone: string;
  adresse_postale: string;
}
export interface EvenementModification {
  nom: string;
  id_type_evenement: number;
  id_theme: number | null;
  date_debut: string;
  date_fin: string;
  lieu: string;
  statut_evenement: string;
  image_url: string | null;
  visible_public: boolean;
}
export interface CompteSaisie {
  email_connexion: string;
  nom_utilisateur: string;
  prenom: string;
  nom: string;
  role: 'client' | 'employe';
  id_client: string | null;
}
export interface TacheSaisie {
  id_evenement: string;
  id_utilisateur: string;
  titre: string;
  description: string | null;
  date_echeance: string | null;
}
