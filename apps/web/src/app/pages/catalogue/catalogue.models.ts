/** Projection publique : aucun prix ni identite du client. */
export interface EvenementPublic {
  id_evenement: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  lieu: string;
  statut_evenement: string;
  libelle_type: string;
  libelle_theme: string | null;
  image_url: string | null;
}
export interface PageEvenements {
  evenements: EvenementPublic[];
  total: number;
  page: number;
  par_page: number;
}
export interface FiltresCatalogue {
  types: { id_type_evenement: number; libelle: string }[];
  themes: { id_theme: number; libelle: string }[];
}
