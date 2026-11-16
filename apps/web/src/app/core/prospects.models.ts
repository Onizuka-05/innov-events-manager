export interface Prospect {
  id_prospect: string;
  entreprise: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  statut_prospect: string;
  id_client: string | null;
  id_type_evenement: number;
  lieu_souhaite: string;
  date_souhaitee: string;
}
