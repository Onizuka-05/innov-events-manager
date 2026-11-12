import type { Request, Response } from 'express';
import { SanteService } from '../services/sante.service.js';

/** Traduit l'etat des dependances en reponse HTTP. */
export class SanteController {
  constructor(private readonly service: SanteService) {}

  verifier = async (_requete: Request, reponse: Response): Promise<void> => {
    const etat = await this.service.verifier();
    reponse.setHeader('Cache-Control', 'no-store');
    reponse.status(etat.statut === 'ok' ? 200 : 503).json(etat);
  };
}
