import { Router } from 'express';
import { EvenementsPublicsController } from '../controllers/evenements-publics.controller.js';

/** Routes publiques, sans session requise ; /filtres est declaree avant /:id. */
export function creerRoutesEvenementsPublics(c: EvenementsPublicsController): Router {
  const r = Router();
  r.get('/evenements-publics', c.lister);
  r.get('/evenements-publics/filtres', c.filtres);
  r.get('/evenements-publics/:id', c.detail);
  return r;
}
