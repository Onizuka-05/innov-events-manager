import { Router } from 'express';
import { AuthentificationController } from '../controllers/authentification.controller.js';
import { exigerRoles } from '../middlewares/authentification.middleware.js';
import { limiterDebit } from '../middlewares/ip-client.middleware.js';
import { AuthentificationService } from '../services/authentification.service.js';

/** Les quotas specifiques s'ajoutent au quota global par IP de confiance. */
export function creerRoutesAuthentification(
  controller: AuthentificationController,
  service: AuthentificationService,
): Router {
  const routes = Router();
  routes.post('/inscriptions', limiterDebit(5), controller.inscrire);
  routes.post('/sessions', limiterDebit(10), controller.connecter);
  routes.get(
    '/sessions/courante',
    exigerRoles(service, ['client', 'employe', 'admin']),
    controller.courante,
  );
  routes.delete('/sessions', controller.deconnecter);
  routes.post('/mots-de-passe-oublies', limiterDebit(5, 60 * 60000), controller.oublier);
  routes.patch('/mot-de-passe', limiterDebit(10), controller.changer);
  return routes;
}
