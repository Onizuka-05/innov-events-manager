import { ErreurHttp } from '../http/erreur-http.js';
import type { ErrorRequestHandler, RequestHandler } from 'express';

/** Reponse neutre pour les routes absentes. */
export const routeAbsente: RequestHandler = (_requete, reponse) => {
  reponse.status(404).json({ erreur: 'Ressource introuvable' });
};

interface ErreurConnue {
  code?: string;
  type?: string;
}

/** Associe les erreurs attendues a un statut et a un message sans detail technique. */
function qualifierErreur(erreur: unknown): { statut: number; message: string } {
  const { code, type } = (erreur ?? {}) as ErreurConnue;
  if (code === 'EBADCSRFTOKEN') return { statut: 403, message: 'Jeton CSRF invalide' };
  // Erreurs du lecteur JSON d'Express : la faute vient de la requete, pas du serveur.
  if (type === 'entity.parse.failed') return { statut: 400, message: 'Donnees JSON invalides' };
  if (type === 'entity.too.large') return { statut: 413, message: 'Requete trop volumineuse' };
  return { statut: 500, message: 'Erreur interne' };
}

/** Evite de transmettre des traces ou des details techniques au navigateur. */
export const gererErreurs: ErrorRequestHandler = (erreur: unknown, _requete, reponse, suivant) => {
  if (reponse.headersSent) {
    suivant(erreur);
    return;
  }
  if (erreur instanceof ErreurHttp) {
    reponse
      .status(erreur.statut)
      .json({ erreur: erreur.message, ...(erreur.code ? { code: erreur.code } : {}) });
    return;
  }
  const { statut, message } = qualifierErreur(erreur);
  if (statut === 500) console.error(JSON.stringify({ evenement: 'erreur_interne' }));
  reponse.status(statut).json({ erreur: message });
};
