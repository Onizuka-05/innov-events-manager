import { describe, expect, it, vi } from 'vitest';
import type { MongoClient } from 'mongodb';
import {
  DUREE_JOURNAUX_CONNEXION_SECONDES,
  LogsRepository,
  TYPES_JOURNAUX_CONNEXION,
} from './logs.repository.js';
import { LogsService } from '../services/logs.service.js';

function fauxMongo() {
  const collection = {
    createIndex: vi.fn(async () => 'ttl_journaux_connexion'),
    insertOne: vi.fn(),
  };
  const db = vi.fn(() => ({ collection: vi.fn(() => collection) }));
  return { client: { db } as unknown as MongoClient, collection, db };
}

describe('Expiration des journaux de connexion', () => {
  it('cree un index TTL partiel de 180 jours limite aux connexions', async () => {
    const { client, collection, db } = fauxMongo();
    await new LogsRepository(client, 'innov_events').preparerIndexExpiration();
    expect(db).toHaveBeenCalledWith('innov_events');
    expect(collection.createIndex).toHaveBeenCalledWith(
      { horodatage: 1 },
      {
        name: 'ttl_journaux_connexion',
        expireAfterSeconds: 15_552_000,
        partialFilterExpression: {
          type_action: { $in: ['CONNEXION_REUSSIE', 'CONNEXION_ECHOUEE'] },
        },
      },
    );
    expect(DUREE_JOURNAUX_CONNEXION_SECONDES).toBe(180 * 86_400);
  });

  it('couvre exactement les types ecrits par le service de journalisation', async () => {
    const { client, collection } = fauxMongo();
    const service = new LogsService(new LogsRepository(client, 'innov_events'));
    await service.connexion('1', '203.0.113.7');
    await service.echec('inconnu@example.org', '203.0.113.8');
    const types = collection.insertOne.mock.calls.map(
      (appel) => (appel as unknown as [{ type_action: string }])[0].type_action,
    );
    expect(types).toEqual([...TYPES_JOURNAUX_CONNEXION]);
  });
});
