import { ErreurHttp } from './erreur-http.js';

/** Refuse les objets absents, tableaux et champs non prevus par le contrat. */
export function objet(valeur: unknown, champs: readonly string[]): Record<string, unknown> {
  if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) invalide();
  const donnees = valeur as Record<string, unknown>;
  if (Object.keys(donnees).some((cle) => !champs.includes(cle))) invalide();
  return donnees;
}

/** Lit une chaine, sans transformer silencieusement un objet ou un nombre. */
export function texte(
  donnees: Record<string, unknown>,
  cle: string,
  max: number,
  facultatif = false,
): string {
  const valeur = donnees[cle];
  if (facultatif && (valeur === undefined || valeur === '')) return '';
  if (
    typeof valeur !== 'string' ||
    valeur.length > max ||
    [...valeur].some((c) => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)))
  )
    invalide();
  const resultat = (valeur as string).trim();
  if (!resultat && !facultatif) invalide();
  return resultat;
}

/** Normalise uniquement l'adresse de connexion, jamais le mot de passe. */
export function email(valeur: string): string {
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(valeur) || valeur.length > 255) invalide();
  return valeur.toLowerCase();
}

/** Regle commune au serveur, au script administrateur et aux formulaires. */
export function motDePasse(valeur: unknown): string {
  if (
    typeof valeur !== 'string' ||
    [...valeur].length < 8 ||
    valeur.length > 256 ||
    !/\p{Lu}/u.test(valeur) ||
    !/\p{Ll}/u.test(valeur) ||
    !/[0-9]/u.test(valeur) ||
    !/[^\p{L}\p{N}\s]/u.test(valeur)
  ) {
    throw new ErreurHttp(
      400,
      'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
    );
  }
  return valeur;
}

/** Produit une erreur de saisie sans recopier de valeur de l'utilisateur. */
export function invalide(): never {
  throw new ErreurHttp(400, 'Vérifiez les champs du formulaire.');
}
