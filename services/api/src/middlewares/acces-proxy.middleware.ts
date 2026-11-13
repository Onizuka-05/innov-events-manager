import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

const ENTETE_SECRET_PROXY = 'x-innov-proxy-secret';

/** Renvoie une empreinte de taille fixe pour comparer des entrees de longueurs distinctes. */
function empreinte(valeur: string): Buffer {
  return createHash('sha256').update(valeur, 'utf8').digest();
}

/** Refuse l'acces direct a l'API, sauf sa route de sante publique en lecture. */
export function verifierAccesProxy(secretAttendu: string): RequestHandler {
  const empreinteAttendue = empreinte(secretAttendu);
  return (requete, reponse, suivant) => {
    if (
      requete.method === 'GET' &&
      (requete.path === '/api/sante' || requete.path === '/api/sante/')
    ) {
      suivant();
      return;
    }

    const secretRecu = requete.headers[ENTETE_SECRET_PROXY];
    // Un tableau ou une absence d'en-tete est refuse : aucune valeur client n'est privilegiee.
    if (
      typeof secretRecu !== 'string' ||
      !timingSafeEqual(empreinte(secretRecu), empreinteAttendue)
    ) {
      reponse.status(403).json({ erreur: 'Acces refuse' });
      return;
    }
    suivant();
  };
}
