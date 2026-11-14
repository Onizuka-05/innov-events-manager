import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { lireIpClient } from './ip-client.middleware.js';

describe('IP dediee provenant du proxy authentifie', () => {
  const app = express();
  app.use(lireIpClient);
  app.get('/', (_req, res) => res.json({ ip: res.locals['ipClient'] }));
  it.each(['127.0.0.1', '192.0.2.10', '2001:db8::1'])(
    'accepte une IP simple valide : %s',
    async (ip) => {
      expect((await request(app).get('/').set('X-Innov-Client-Ip', ip)).body).toEqual({ ip });
    },
  );
  it.each(['invalide', '192.0.2.1, 203.0.113.1', '192.0.2.1:443', '[2001:db8::1]', ''])(
    'refuse une valeur ambigue : %s',
    async (ip) => {
      expect((await request(app).get('/').set('X-Innov-Client-Ip', ip)).status).toBe(400);
    },
  );
  it('ne se replie pas sur CF-Connecting-IP ou X-Forwarded-For', async () => {
    expect(
      (
        await request(app)
          .get('/')
          .set('CF-Connecting-IP', '192.0.2.1')
          .set('X-Forwarded-For', '192.0.2.1')
      ).status,
    ).toBe(400);
  });
});
