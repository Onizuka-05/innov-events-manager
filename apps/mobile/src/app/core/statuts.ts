/** Familles visuelles de la charte graphique (CO-09, §6). */
export type FamilleStatut = 'neutre' | 'information' | 'alerte' | 'succes' | 'erreur';

/**
 * Table de correspondance unique entre les statuts metier et leur famille visuelle,
 * identique a celle de l'application web (table « Familles visuelles des statuts » de CO-09).
 */
export const FAMILLES_STATUT: Readonly<Record<string, FamilleStatut>> = {
  brouillon: 'neutre',
  en_preparation: 'neutre',
  a_faire: 'neutre',
  a_contacter: 'information',
  etude_client: 'information',
  en_cours: 'information',
  modification: 'alerte',
  en_attente: 'alerte',
  suspendu: 'alerte',
  accepte: 'succes',
  valide: 'succes',
  converti: 'succes',
  termine: 'succes',
  actif: 'succes',
  refuse: 'erreur',
  annule: 'erreur',
  echoue: 'erreur',
  supprime: 'erreur',
};

/** Libelles lisibles des statuts ; les valeurs du contrat API restent inchangees. */
export const LIBELLES_STATUT: Readonly<Record<string, string>> = {
  brouillon: 'Brouillon',
  en_preparation: 'En préparation',
  a_faire: 'À faire',
  a_contacter: 'À contacter',
  etude_client: 'Étude client',
  en_cours: 'En cours',
  modification: 'Modification demandée',
  en_attente: 'En attente',
  suspendu: 'Suspendu',
  accepte: 'Accepté',
  valide: 'Validé',
  converti: 'Converti',
  termine: 'Terminé',
  actif: 'Actif',
  refuse: 'Refusé',
  annule: 'Annulé',
  echoue: 'Échoué',
  supprime: 'Supprimé',
};

/** Famille d'un statut ; un statut inconnu reste neutre plutot que de signaler un etat faux. */
export function familleStatut(statut: string): FamilleStatut {
  return FAMILLES_STATUT[statut] ?? 'neutre';
}

/** Libelle d'un statut ; la valeur brute est affichee si elle est inconnue. */
export function libelleStatut(statut: string): string {
  return LIBELLES_STATUT[statut] ?? statut;
}
