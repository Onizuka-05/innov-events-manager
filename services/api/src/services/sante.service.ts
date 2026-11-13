import { SanteRepository } from '../repositories/sante.repository.js';

export type EtatConnexion = 'ok' | 'indisponible';
export interface EtatSante {
  statut: 'ok' | 'degrade';
  services: { postgresql: EtatConnexion; mongodb: EtatConnexion };
}

/** Agrege les resultats sans divulguer les erreurs de connexion. */
export class SanteService {
  constructor(private readonly repository: SanteRepository) {}

  async verifier(): Promise<EtatSante> {
    const [sql, mongo] = await Promise.allSettled([
      this.repository.verifierPostgresql(),
      this.repository.verifierMongodb(),
    ]);
    const postgresql = sql.status === 'fulfilled' ? 'ok' : 'indisponible';
    const mongodb = mongo.status === 'fulfilled' ? 'ok' : 'indisponible';
    return {
      statut: postgresql === 'ok' && mongodb === 'ok' ? 'ok' : 'degrade',
      services: { postgresql, mongodb },
    };
  }
}
