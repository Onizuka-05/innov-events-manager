import { Router } from 'express';
import { SanteController } from '../controllers/sante.controller.js';

/** Enregistre les URL d'observabilite de l'API. */
export function creerRoutesSante(controller: SanteController): Router {
  const routeur = Router();
  routeur.get('/', controller.verifier);
  return routeur;
}
