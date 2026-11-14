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

const enteteProxy = configuration.secretProxyInterne;

// Sessions en memoire : le test porte sur le CSRF, pas sur PostgreSQL.
function application() {
  const postgres = { query: vi.fn() } as unknown as Pool;
  const mongodb = { db: vi.fn() } as unknown as MongoClient;
  return creerApp({
    postgres,
    mongodb,
    configuration,
    stockageSession: new session.MemoryStore(),
  });
}

describe('Protection CSRF', () => {
  it('fournit un jeton et un cookie de session httpOnly', async () => {
    const resultat = await request(application())
      .get('/api/csrf')
      .set('X-Innov-Proxy-Secret', enteteProxy)
      .set('X-Innov-Client-Ip', '192.0.2.1');
    expect(resultat.status).toBe(200);
    expect(typeof resultat.body.jeton_csrf).toBe('string');
    expect(resultat.headers['cache-control']).toBe('no-store');
    const cookies = ([] as string[]).concat(resultat.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith('innov.sid=') && /HttpOnly/i.test(c))).toBe(true);
  });

  it('refuse une requete modifiante sans jeton', async () => {
    const resultat = await request(application())
      .post('/api/essai')
      .set('X-Innov-Proxy-Secret', enteteProxy)
      .set('X-Innov-Client-Ip', '192.0.2.1')
      .send({});
    expect(resultat.status).toBe(403);
    expect(resultat.body).toEqual({ erreur: 'Jeton CSRF invalide' });
  });

  it('refuse un jeton qui ne correspond pas a la session', async () => {
    const agent = request.agent(application());
    await agent
      .get('/api/csrf')
      .set('X-Innov-Proxy-Secret', enteteProxy)
      .set('X-Innov-Client-Ip', '192.0.2.1');
    const resultat = await agent
      .post('/api/essai')
      .set('X-Innov-Proxy-Secret', enteteProxy)
      .set('X-Innov-Client-Ip', '192.0.2.1')
      .set('X-CSRF-Token', 'jeton-invente')
      .send({});
    expect(resultat.status).toBe(403);
  });

  it('laisse passer une requete modifiante avec le jeton de sa session', async () => {
    const agent = request.agent(application());
    const { body } = await agent
      .get('/api/csrf')
      .set('X-Innov-Proxy-Secret', enteteProxy)
      .set('X-Innov-Client-Ip', '192.0.2.1');
    const resultat = await agent
      .post('/api/essai')
      .set('X-Innov-Proxy-Secret', enteteProxy)
      .set('X-Innov-Client-Ip', '192.0.2.1')
      .set('X-CSRF-Token', body.jeton_csrf)
      .send({});
    // La route n'existe pas : 404 prouve que le controle CSRF a ete franchi.
    expect(resultat.status).toBe(404);
  });
});
