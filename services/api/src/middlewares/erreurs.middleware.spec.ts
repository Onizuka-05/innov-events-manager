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
  pgHost: 'localhost',
  pgPort: 5432,
  pgDatabase: 'innov_events',
  pgUser: 'innov_events_app',
  pgPassword: 'test',
  mongodbUrl: 'mongodb://localhost:27017',
  mongodbDatabase: 'innov_events_logs',
};

function application() {
  return creerApp({
    postgres: { query: vi.fn() } as unknown as Pool,
    mongodb: { db: vi.fn() } as unknown as MongoClient,
    configuration,
    stockageSession: new session.MemoryStore(),
  });
}

describe('Gestionnaire central des erreurs', () => {
  it('repond 404 sans detail pour une route absente', async () => {
    const resultat = await request(application()).get('/api/inexistant');
    expect(resultat.status).toBe(404);
    expect(resultat.body).toEqual({ erreur: 'Ressource introuvable' });
  });

  it('repond 400 pour un JSON mal forme, sans detail technique', async () => {
    const resultat = await request(application())
      .post('/api/essai')
      .set('Content-Type', 'application/json')
      .send('{"nom":');
    expect(resultat.status).toBe(400);
    expect(resultat.body).toEqual({ erreur: 'Donnees JSON invalides' });
  });

  it('repond 413 pour un corps superieur a 32 ko', async () => {
    const resultat = await request(application())
      .post('/api/essai')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ texte: 'x'.repeat(40 * 1024) }));
    expect(resultat.status).toBe(413);
    expect(resultat.body).toEqual({ erreur: 'Requete trop volumineuse' });
  });
});
