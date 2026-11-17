import { Router } from 'express';
import { EspaceClientController } from '../controllers/espace-client.controller.js';
import { exigerRoles } from '../middlewares/authentification.middleware.js';
import { limiterDebit } from '../middlewares/ip-client.middleware.js';
import type { AuthentificationService } from '../services/authentification.service.js';

/** Routes reservees au role client ; la propriete est verifiee dans le repository. */
export function creerRoutesEspaceClient(
  c: EspaceClientController,
  auth: AuthentificationService,
): Router {
  const r = Router();
  const client = exigerRoles(auth, ['client']);
  r.get('/espace-client', client, c.accueil);
  r.get('/profil', client, c.profil);
  // Les deux operations peuvent verifier un mot de passe : quota dedie contre les essais repetes.
  r.patch('/profil', client, limiterDebit(20), c.modifierProfil);
  r.delete('/profil', client, limiterDebit(10), c.supprimerProfil);
  r.get('/mes-evenements', client, c.evenements);
  r.post('/mes-evenements/:id/avis', client, c.creerAvis);
  r.post('/mes-evenements/:id/accord-publication', client, c.donnerAccord);
  r.delete('/mes-evenements/:id/accord-publication', client, c.retirerAccord);
  return r;
}
