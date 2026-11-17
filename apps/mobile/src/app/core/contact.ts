/** Lien d'appel : le numero est nettoye des espaces, points, tirets et parentheses. */
export function lienTelephone(telephone: string | null): string | null {
  const numero = (telephone ?? '').replace(/[^\d+]/gu, '');
  return /\d/u.test(numero) ? `tel:${numero}` : null;
}

/** Lien d'envoi d'e-mail ; l'adresse vient d'une fiche validee par l'API. */
export function lienCourriel(email: string | null): string | null {
  const adresse = (email ?? '').trim();
  return adresse.includes('@') ? `mailto:${adresse}` : null;
}

/**
 * Itineraire vers l'adresse postale : Plans sur iPhone et iPad, Google Maps ailleurs.
 * L'adresse est encodee dans l'URL.
 */
export function lienItineraire(adresse: string | null, ios: boolean): string | null {
  const destination = (adresse ?? '').trim();
  if (!destination) return null;
  const encodee = encodeURIComponent(destination);
  return ios
    ? `https://maps.apple.com/?daddr=${encodee}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodee}`;
}
