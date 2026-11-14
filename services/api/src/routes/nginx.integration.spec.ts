import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import session from 'express-session';
import type { MongoClient } from 'mongodb';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { creerApp } from '../app.js';
import type { Configuration } from '../config/config.js';
import type { Journal } from '../repositories/logs.repository.js';

/** Ferme les serveurs de test sans toucher a des processus exterieurs. */
async function fermer(serveur: Server): Promise<void> {
  serveur.closeAllConnections();
  await new Promise<void>((resolve) => serveur.close(() => resolve()));
}
async function portLibre(): Promise<number> {
  const serveur = createServer();
  await new Promise<void>((resolve) => serveur.listen(0, '127.0.0.1', resolve));
  const port = (serveur.address() as { port: number }).port;
  await fermer(serveur);
  return port;
}

describe.skipIf(!process.env.NGINX_BIN)('IP a travers nginx reel', () => {
  let nginx: ChildProcess | undefined;
  let serveur: Server | undefined;
  let dossier: string | undefined;
  afterEach(async () => {
    if (nginx && nginx.exitCode === null) {
      const fin = new Promise<void>((resolve) => nginx!.once('exit', () => resolve()));
      nginx.kill('SIGTERM');
      await fin;
    }
    if (serveur) await fermer(serveur);
    if (dossier) await rm(dossier, { recursive: true, force: true });
  });

  it.each(['web', 'mobile'])(
    '%s ecrase les IP et le secret forges avant la journalisation',
    async (front) => {
      const journaux: Journal[] = [];
      const configuration = {
        production: false,
        trustProxyHops: 0,
        secretProxyInterne: 'un-secret-proxy-interne-de-32-caracteres',
        sessionSecret: 'un-secret-session-interne-de-32-caracteres',
        mongodbDatabase: 'test',
      } as Configuration;
      const mongodb = {
        db: () => ({
          collection: () => ({
            insertOne: async (j: Journal) => {
              journaux.push(j);
            },
          }),
        }),
      } as unknown as MongoClient;
      const postgres = { query: async () => ({ rows: [] }) } as unknown as Pool;
      const app = creerApp({
        postgres,
        mongodb,
        configuration,
        stockageSession: new session.MemoryStore(),
        courriels: { envoyer: async () => undefined },
      });
      serveur = app.listen(0, '127.0.0.1');
      await new Promise<void>((resolve) => serveur!.once('listening', resolve));
      const portApi = (serveur.address() as { port: number }).port;
      dossier = await mkdtemp(join(tmpdir(), 'innov-nginx-'));
      const port = await portLibre();
      let modele = await readFile(
        new URL(`../../../../apps/${front}/nginx.conf`, import.meta.url),
        'utf8',
      );
      modele = modele
        .replaceAll('${API_UPSTREAM}', `http://127.0.0.1:${portApi}`)
        .replaceAll('${NGINX_SCHEME}', 'http')
        .replaceAll('${NGINX_CLIENT_IP_SOURCE}', '$remote_addr')
        .replaceAll('${INTERNAL_PROXY_SECRET}', configuration.secretProxyInterne)
        .replace('listen 8080;', `listen 127.0.0.1:${port};`);
      const fichier = join(dossier, 'nginx.conf');
      await writeFile(
        fichier,
        `daemon off; pid ${dossier}/nginx.pid; error_log ${dossier}/error.log; events {} http { access_log off; client_body_temp_path ${dossier}; proxy_temp_path ${dossier}; fastcgi_temp_path ${dossier}; uwsgi_temp_path ${dossier}; scgi_temp_path ${dossier}; ${modele} }`,
      );
      nginx = spawn(process.env.NGINX_BIN!, ['-p', dossier, '-c', fichier, '-e', 'stderr'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let diagnostic = '';
      nginx.stderr?.on('data', (sortie: Buffer) => {
        diagnostic += sortie.toString();
      });
      const url = `http://127.0.0.1:${port}`;
      let csrf: Response | undefined;
      for (let i = 0; i < 60; i++) {
        try {
          csrf = await fetch(`${url}/api/csrf`);
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
      if (!csrf)
        throw new Error(diagnostic || (await readFile(join(dossier, 'error.log'), 'utf8')));
      expect(csrf.status).toBe(200);
      const { jeton_csrf } = (await csrf.json()) as { jeton_csrf: string };
      const cookie = csrf.headers.get('set-cookie')!.split(';')[0]!;
      const resultat = await fetch(`${url}/api/sessions`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
          'X-CSRF-Token': jeton_csrf,
          'CF-Connecting-IP': '203.0.113.250',
          'X-Forwarded-For': '203.0.113.251',
          'X-Innov-Client-Ip': '203.0.113.252',
          'X-Innov-Proxy-Secret': 'forge',
        },
        body: JSON.stringify({ email_connexion: 'inexistant@example.org', mot_de_passe: 'faux' }),
      });
      expect(resultat.status).toBe(401);
      expect(journaux).toHaveLength(1);
      expect(journaux[0]?.details['ip']).toBe('127.0.0.1');
      expect(JSON.stringify(journaux)).not.toContain('203.0.113.25');
    },
    15000,
  );
});
