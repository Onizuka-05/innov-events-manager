import { isIP } from 'node:net';
import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

/** Ne lit ni CF-Connecting-IP ni X-Forwarded-For dans l'API. */
export const lireIpClient: RequestHandler = (requete, reponse, suivant) => {
  const ip = requete.headers['x-innov-client-ip'];
  if (typeof ip !== 'string' || isIP(ip) === 0) {
    reponse.status(400).json({ erreur: 'Adresse réseau invalide' });
    return;
  }
  reponse.locals['ipClient'] = ip;
  suivant();
};

/** Meme origine de confiance pour la limitation et les journaux, IPv6 agregee en /56. */
export function limiterDebit(limit: number, windowMs = 15 * 60000): RequestHandler {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_requete, reponse) => ipKeyGenerator(reponse.locals['ipClient'] as string),
    message: { erreur: 'Trop de demandes. Réessayez dans quelques minutes.' },
  });
}
