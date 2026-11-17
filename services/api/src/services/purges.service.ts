import type { LogsRepository } from '../repositories/logs.repository.js';
import type { PurgesRepository } from '../repositories/purges.repository.js';

/** Intervalle entre deux passages de la purge : 24 heures. */
export const INTERVALLE_PURGES_MS = 24 * 60 * 60_000;

/** Bilan d'un passage ; null pour une etape en echec. Aucune donnee personnelle. */
export interface BilanPurges {
  prospects_supprimes: number | null;
  noms_retires: number | null;
  journaux_supprimes: number | null;
}

/**
 * Purges automatiques des donnees personnelles (TR-04) :
 * - demandes classees sans suite depuis plus de 3 ans apres le dernier contact ;
 * - retrait du nom des journaux d'un client qui a demande l'effacement de son compte
 *   (reprise si la mise a jour faite lors de l'effacement a echoue), seulement pour une fiche
 *   effectivement anonymisee en base ;
 * - journaux de plus d'un an, hors journaux de connexion (index d'expiration de 6 mois).
 * Lancee au demarrage puis toutes les 24 heures. Un service en veille ne purge pas :
 * le passage au demarrage rattrape les purges a la prochaine activite.
 */
export class PurgesService {
  private enCours = false;
  constructor(
    private readonly base: PurgesRepository,
    private readonly journaux: LogsRepository,
    private readonly maintenant: () => Date = () => new Date(),
  ) {}

  /** Execute chaque etape independamment ; un echec est consigne sans arreter l'API. */
  async executer(): Promise<BilanPurges | null> {
    if (this.enCours) return null;
    this.enCours = true;
    try {
      const prospects = await this.etape('prospects_echoues', () =>
        this.base.supprimerProspectsEchoues(),
      );
      const noms = await this.etape('retrait_noms_journaux', async () =>
        this.journaux.retirerNomClient(
          await this.base.fichesAnonymisees(await this.journaux.clientsEffaces()),
        ),
      );
      const limite = this.maintenant();
      limite.setFullYear(limite.getFullYear() - 1);
      const journaux = await this.etape('journaux_anciens', () =>
        this.journaux.supprimerAnterieurs(limite),
      );
      const bilan = {
        prospects_supprimes: prospects,
        noms_retires: noms,
        journaux_supprimes: journaux,
      };
      console.info(JSON.stringify({ evenement: 'purges_terminees', ...bilan }));
      return bilan;
    } finally {
      this.enCours = false;
    }
  }

  /** Lance un passage immediat puis un passage par intervalle ; renvoie la fonction d'arret. */
  demarrer(intervalle = INTERVALLE_PURGES_MS): () => void {
    void this.executer();
    const minuterie = setInterval(() => void this.executer(), intervalle);
    // La minuterie n'empeche pas l'arret du processus.
    minuterie.unref();
    return () => clearInterval(minuterie);
  }

  private async etape(nom: string, operation: () => Promise<number>): Promise<number | null> {
    try {
      return await operation();
    } catch {
      console.error(JSON.stringify({ evenement: 'purge_echec', etape: nom }));
      return null;
    }
  }
}
