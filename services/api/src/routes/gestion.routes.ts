import { Router } from 'express';
import { GestionController } from '../controllers/gestion.controller.js';
import { exigerRoles } from '../middlewares/authentification.middleware.js';
import type { AuthentificationService } from '../services/authentification.service.js';

/** Chaque operation porte son controle de role cote serveur. */
export function creerRoutesGestion(c: GestionController, auth: AuthentificationService): Router {
  const r = Router(),
    admin = exigerRoles(auth, ['admin']),
    equipe = exigerRoles(auth, ['admin', 'employe']);
  r.get('/administration/tableau-de-bord', admin, c.tableau);
  r.get('/clients', equipe, c.clients);
  r.get('/clients/:id', equipe, c.client);
  r.post('/clients', admin, c.enregistrerClient);
  r.patch('/clients/:id', admin, c.enregistrerClient);
  r.delete('/clients/:id', admin, c.supprimerClient);
  r.get('/evenements', equipe, c.evenements);
  r.get('/evenements/:id', equipe, c.evenement);
  r.patch('/evenements/:id', admin, c.modifierEvenement);
  r.delete('/evenements/:id', admin, c.supprimerEvenement);
  r.get('/notes-globales', admin, c.notesGlobales);
  r.post('/notes', equipe, c.creerNote);
  r.patch('/notes/:id', equipe, c.modifierNote);
  r.delete('/notes/:id', equipe, c.supprimerNote);
  r.post('/taches', admin, c.creerTache);
  r.post('/taches/:id/affectation', admin, c.affecterTache);
  r.post('/taches/:id/statut', equipe, c.statutTache);
  r.get('/comptes', admin, c.comptes);
  r.post('/comptes', admin, c.creerCompte);
  r.post('/comptes/:id/statut', admin, c.statutCompte);
  r.delete('/comptes/:id', admin, c.supprimerCompte);
  r.get('/avis/moderation', equipe, c.avis);
  r.post('/avis/:id/moderation', equipe, c.moderer);
  r.get('/avis', c.avisPublics);
  r.get('/journaux', admin, c.journaux);
  return r;
}
