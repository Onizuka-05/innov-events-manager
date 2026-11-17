import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogsRepository } from '../repositories/logs.repository.js';
import type { PurgesRepository } from '../repositories/purges.repository.js';
import { INTERVALLE_PURGES_MS, PurgesService } from './purges.service.js';

function preparer() {
  const prospects = {
    supprimerProspectsEchoues: vi.fn(async () => 2),
    fichesAnonymisees: vi.fn(async (ids: readonly string[]) => ids.filter((id) => id !== '8')),
  };
  const journaux = {
    clientsEffaces: vi.fn(async () => ['7', '8']),
    retirerNomClient: vi.fn(async () => 1),
    supprimerAnterieurs: vi.fn(async () => 4),
  };
  const service = new PurgesService(
    prospects as unknown as PurgesRepository,
    journaux as unknown as LogsRepository,
    () => new Date('2026-11-17T08:00:00.000Z'),
  );
  return { prospects, journaux, service };
}

describe('Purges automatiques', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('enchaine les trois etapes et consigne un bilan sans donnee personnelle', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { service, journaux, prospects } = preparer();
    expect(await service.executer()).toEqual({
      prospects_supprimes: 2,
      noms_retires: 1,
      journaux_supprimes: 4,
    });
    // La fiche 8 n'est pas anonymisee : son journal d'effacement n'est pas repris.
    expect(prospects.fichesAnonymisees).toHaveBeenCalledWith(['7', '8']);
    expect(journaux.retirerNomClient).toHaveBeenCalledWith(['7']);
    expect(journaux.supprimerAnterieurs).toHaveBeenCalledWith(new Date('2025-11-17T08:00:00.000Z'));
    expect(info).toHaveBeenCalledWith(
      JSON.stringify({
        evenement: 'purges_terminees',
        prospects_supprimes: 2,
        noms_retires: 1,
        journaux_supprimes: 4,
      }),
    );
  });

  it('poursuit apres l echec d une etape et ne lance jamais deux passages a la fois', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service, prospects } = preparer();
    prospects.supprimerProspectsEchoues.mockRejectedValueOnce(new Error('base indisponible'));
    const [premier, second] = await Promise.all([service.executer(), service.executer()]);
    expect(premier).toEqual({ prospects_supprimes: null, noms_retires: 1, journaux_supprimes: 4 });
    expect(second).toBeNull();
    expect(erreurs).toHaveBeenCalledWith(
      JSON.stringify({ evenement: 'purge_echec', etape: 'prospects_echoues' }),
    );
  });

  it('passe au demarrage puis toutes les 24 heures, jusqu a l arret', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { service, prospects } = preparer();
    const arreter = service.demarrer();
    await vi.advanceTimersByTimeAsync(0);
    expect(prospects.supprimerProspectsEchoues).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVALLE_PURGES_MS);
    expect(prospects.supprimerProspectsEchoues).toHaveBeenCalledTimes(2);
    arreter();
    await vi.advanceTimersByTimeAsync(INTERVALLE_PURGES_MS * 2);
    expect(prospects.supprimerProspectsEchoues).toHaveBeenCalledTimes(2);
  });
});
