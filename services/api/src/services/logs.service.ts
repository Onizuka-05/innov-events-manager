import { LogsRepository } from '../repositories/logs.repository.js';

/** Journalisation limitee aux donnees necessaires, jamais au corps HTTP. */
export class LogsService {
  constructor(private readonly repository: LogsRepository) {}

  /** Conserve la structure commune des journaux applicatifs. */
  action(
    type_action: string,
    id_utilisateur: string,
    details: Record<string, string | number | null>,
  ): Promise<void> {
    return this.repository.ajouter({
      horodatage: new Date(),
      type_action,
      id_utilisateur: String(id_utilisateur),
      details,
    });
  }

  /** Enregistre l'IP validee par le middleware de confiance. */
  connexion(id: string, ip: string): Promise<void> {
    return this.repository.ajouter({
      horodatage: new Date(),
      type_action: 'CONNEXION_REUSSIE',
      id_utilisateur: id,
      details: { ip },
    });
  }

  /** Ne revele pas si le compte tente existe. */
  echec(email: string, ip: string): Promise<void> {
    return this.repository.ajouter({
      horodatage: new Date(),
      type_action: 'CONNEXION_ECHOUEE',
      id_utilisateur: null,
      details: { email, ip },
    });
  }
}
