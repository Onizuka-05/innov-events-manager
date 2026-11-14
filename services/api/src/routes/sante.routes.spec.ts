import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { MongoClient } from 'mongodb';
import type { Pool } from 'pg';
import { creerApp } from '../app.js';
import type { Configuration } from '../config/config.js';

const configuration: Configuration = {
  port: 3000,
  production: false,
  trustProxyHops: 0,
  sessionSecret: 'un-secret-de-test-d-au-moins-32-caracteres',
  secretProxyInterne: 'secret-proxy-de-test-d-au-moins-32-caracteres',
  pgHost: 'localhost',
  pgPort: 5432,
  pgDatabase: 'innov_events',
  pgUser: 'innov_events_app',
  pgPassword: 'test',
  mongodbUrl: 'mongodb://localhost:27017',
  mongodbDatabase: 'innov_events_logs',
};

function application(postgresDisponible = true, mongodbDisponible = true) {
  const query = postgresDisponible
    ? vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] })
    : vi.fn().mockRejectedValue(new Error('Postgres indisponible'));
  const command = mongodbDisponible
    ? vi.fn().mockResolvedValue({ ok: 1 })
    : vi.fn().mockRejectedValue(new Error('Mongo indisponible'));
  const postgres = { query } as unknown as Pool;
  const mongodb = { db: vi.fn().mockReturnValue({ command }) } as unknown as MongoClient;
  return creerApp({ postgres, mongodb, configuration });
}

describe('GET /api/sante', () => {
  it('retourne 200 quand les deux bases repondent', async () => {
    const resultat = await request(application()).get('/api/sante');
    expect(resultat.status).toBe(200);
    expect(resultat.body).toEqual({
      statut: 'ok',
      services: { postgresql: 'ok', mongodb: 'ok' },
    });
  });

  it('ne crée pas de session (aucun cookie)', async () => {
    const resultat = await request(application()).get('/api/sante');
    expect(resultat.headers['set-cookie']).toBeUndefined();
  });

  it('retourne 503 sans divulguer les erreurs SQL', async () => {
    const resultat = await request(application(false, true)).get('/api/sante');
    expect(resultat.status).toBe(503);
    expect(resultat.body.services.postgresql).toBe('indisponible');
    expect(JSON.stringify(resultat.body)).not.toContain('Postgres indisponible');
  });

  it('retourne 503 si MongoDB ne repond pas', async () => {
    const resultat = await request(application(true, false)).get('/api/sante');
    expect(resultat.status).toBe(503);
    expect(resultat.body.services.mongodb).toBe('indisponible');
  });

  it('ne repond pas OK quand les deux bases sont indisponibles', async () => {
    const resultat = await request(application(false, false)).get('/api/sante');
    expect(resultat.status).toBe(503);
  });
  it('ecrit une ligne JSON neutre sur stdout a chaque 503', async () => {
    const sortie = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      expect((await request(application(false, false)).get('/api/sante')).status).toBe(503);
      expect(sortie).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify({
          evenement: 'sante_degradee',
          postgresql: 'indisponible',
          mongodb: 'indisponible',
        }),
      );
      expect(sortie.mock.calls[0]?.[0]).not.toMatch(
        /Postgres indisponible|Mongo indisponible|password|secret/u,
      );
    } finally {
      sortie.mockRestore();
    }
  });
});
