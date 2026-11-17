/** Projections du compte client, conformes aux reponses de l'API. */
export interface EvenementClient {
  id_evenement: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  lieu: string;
  statut_evenement: string;
  libelle_type: string;
  date_accord_publication: string | null;
  visible_public: boolean;
  avis: { note_evaluation: number; commentaire: string; statut_avis: string } | null;
}
export interface AccueilClientDonnees {
  prochains_evenements: Pick<
    EvenementClient,
    'id_evenement' | 'nom' | 'date_debut' | 'date_fin' | 'lieu' | 'statut_evenement'
  >[];
  suivi: {
    id_prospect: string;
    date_demande: string;
    libelle_type: string;
    statut_prospect: string;
    evenement: {
      id_evenement: string;
      nom: string;
      statut_evenement: string;
      devis: { id_devis: string; intitule: string; statut_devis: string; date_envoi: string }[];
    } | null;
  }[];
}
export interface CompteProfil {
  prenom: string;
  nom: string;
  nom_utilisateur: string;
  email_connexion: string;
}
export interface FicheProfil {
  entreprise: string;
  prenom_contact: string;
  nom_contact: string;
  email_contact: string;
  telephone: string;
  adresse_postale: string | null;
}
export interface ProfilClient {
  compte: CompteProfil;
  fiche: FicheProfil | null;
}
