import session from 'express-session';
import type { MongoClient } from 'mongodb';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
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

function application() {
  const postgres = {
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
  } as unknown as Pool;
  const mongodb = {
    db: vi.fn().mockReturnValue({ command: vi.fn().mockResolvedValue({ ok: 1 }) }),
  } as unknown as MongoClient;
  return creerApp({ postgres, mongodb, configuration, stockageSession: new session.MemoryStore() });
}

describe('Acces a l API par le proxy', () => {
  it('refuse une requete sans en-tete', async () => {
    const resultat = await request(application()).get('/api/csrf');
    expect(resultat.status).toBe(403);
    expect(resultat.body).toEqual({ erreur: 'Acces refuse' });
    expect(resultat.headers['set-cookie']).toBeUndefined();
  });

  it('refuse un en-tete incorrect', async () => {
    const resultat = await request(application())
      .get('/api/csrf')
      .set('X-Innov-Proxy-Secret', 'mauvaise-valeur');
    expect(resultat.status).toBe(403);
    expect(resultat.body).toEqual({ erreur: 'Acces refuse' });
  });

  it('accepte un en-tete correct', async () => {
    const resultat = await request(application())
      .get('/api/csrf')
      .set('X-Innov-Proxy-Secret', configuration.secretProxyInterne)
      .set('X-Innov-Client-Ip', '192.0.2.1');
    expect(resultat.status).toBe(200);
    expect(typeof resultat.body.jeton_csrf).toBe('string');
  });

  it('autorise la sante sans en-tete, sans creer de cookie', async () => {
    const resultat = await request(application()).get('/api/sante');
    expect(resultat.status).toBe(200);
    expect(resultat.headers['set-cookie']).toBeUndefined();
  });

  it('ne contourne pas le controle pour une autre methode ou une autre URL', async () => {
    const autreMethode = await request(application()).post('/api/sante');
    const autreUrl = await request(application()).get('/api/sante/diagnostic');
    expect(autreMethode.status).toBe(403);
    expect(autreUrl.status).toBe(403);
  });
});
