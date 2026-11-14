import { Router } from 'express';
import { FormulairesController } from '../controllers/formulaires.controller.js';
import { exigerRoles } from '../middlewares/authentification.middleware.js';
import { limiterDebit } from '../middlewares/ip-client.middleware.js';
import { AuthentificationService } from '../services/authentification.service.js';

/** Les deux routes d'administration ont chacune leur controle serveur. */
export function creerRoutesFormulaires(
  controller: FormulairesController,
  auth: AuthentificationService,
): Router {
  const routes = Router();
  routes.post('/contacts', limiterDebit(5), controller.contacter);
  routes.get('/types-evenement', controller.types);
  routes.post('/prospects', limiterDebit(5), controller.demander);
  routes.get('/parametres/remerciement', exigerRoles(auth, ['admin']), controller.remerciement);
  routes.patch(
    '/parametres/remerciement',
    exigerRoles(auth, ['admin']),
    controller.modifierRemerciement,
  );
  return routes;
}
