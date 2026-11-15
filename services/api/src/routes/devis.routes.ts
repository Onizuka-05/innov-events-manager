import { Router } from 'express';
import { DevisController } from '../controllers/devis.controller.js';
import { exigerRoles } from '../middlewares/authentification.middleware.js';
import { AuthentificationService } from '../services/authentification.service.js';

/** Les clients ne voient que leurs propres devis, controles dans le repository. */
export function creerRoutesDevis(c: DevisController, auth: AuthentificationService): Router {
  const r = Router();
  const admin = exigerRoles(auth, ['admin']);
  const connecte = exigerRoles(auth, ['admin', 'client']);
  r.get('/prospects', admin, c.prospects);
  r.post('/prospects/:id/conversion', admin, c.convertir);
  r.post('/prospects/:id/echec', admin, c.echouer);
  r.get('/clients', admin, c.clients);
  r.get('/themes', admin, c.themes);
  r.get('/evenements', admin, c.evenements);
  r.post('/evenements', admin, c.creerEvenement);
  r.get('/devis', connecte, c.liste);
  r.post('/devis', admin, c.creer);
  r.get('/devis/:id', connecte, c.detail);
  r.get('/devis/:id/pdf', connecte, c.pdf);
  r.post('/devis/:id/envoi', admin, c.envoyer);
  r.patch('/devis/:id', admin, c.intitule);
  r.post('/devis/:id/lignes', admin, c.lignes);
  r.post('/devis/:id/reponse', exigerRoles(auth, ['client']), c.repondre);
  return r;
}
