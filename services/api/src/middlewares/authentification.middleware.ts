import type { RequestHandler } from 'express';
import { ErreurHttp } from '../http/erreur-http.js';
import type { Role } from '../repositories/utilisateurs.repository.js';
import { AuthentificationService } from '../services/authentification.service.js';

/** Recharge le compte depuis la base, sans faire confiance au role en session. */
export function exigerRoles(
  service: AuthentificationService,
  roles: readonly Role[],
): RequestHandler {
  return async (requete, reponse, suivant) => {
    const auth = requete.session.authentification;
    if (!auth) throw new ErreurHttp(401, 'Connexion requise.');
    if (auth.mode !== 'normale')
      throw new ErreurHttp(403, 'Choisissez un nouveau mot de passe.', 'CHANGEMENT_MDP_REQUIS');
    const compte = await service.verifierSession(auth);
    if (!roles.includes(compte.role)) throw new ErreurHttp(403, 'Accès refusé.');
    reponse.locals['utilisateur'] = compte;
    suivant();
  };
}

/** Bloque aussi les routes publiques pour une session de renouvellement, hors CSRF et sortie. */
export function restreindreSession(service: AuthentificationService): RequestHandler {
  return async (requete, reponse, suivant) => {
    const auth = requete.session.authentification;
    if (auth?.mode === 'restreinte') {
      try {
        await service.verifierSession(auth);
      } catch (erreur) {
        if (erreur instanceof ErreurHttp && erreur.statut === 401) {
          await new Promise<void>((resolve, reject) =>
            requete.session.destroy((e) => (e ? reject(e) : resolve())),
          );
          reponse.clearCookie('innov.sid', { path: '/' });
        }
        throw erreur;
      }
      const chemin = requete.path.replace(/\/$/u, '');
      if (!(
        (requete.method === 'GET' && chemin === '/api/csrf') ||
        (requete.method === 'PATCH' && chemin === '/api/mot-de-passe') ||
        (requete.method === 'DELETE' && chemin === '/api/sessions')
      )) {
        throw new ErreurHttp(403, 'Choisissez un nouveau mot de passe.', 'CHANGEMENT_MDP_REQUIS');
      }
    }
    suivant();
  };
}
