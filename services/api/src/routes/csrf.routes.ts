import { Router } from 'express';
import { CsrfController } from '../controllers/csrf.controller.js';

/** Enregistre l'URL de recuperation du jeton CSRF. */
export function creerRoutesCsrf(controller: CsrfController): Router {
  const routeur = Router();
  routeur.get('/', controller.fournirJeton);
  return routeur;
}
