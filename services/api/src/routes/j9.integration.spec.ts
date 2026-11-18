import type { Courriel } from '../services/courriels.service.js';
import { readFile } from 'node:fs/promises';
import type { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { creerApp } from '../app.js';
import type { Configuration } from '../config/config.js';
import type { Journal } from '../repositories/logs.repository.js';
import { GestionRepository } from '../repositories/gestion.repository.js';
import { MotsDePasseService } from '../services/mots-de-passe.service.js';

const config: Configuration = {
  port: 3000,
  production: false,
  trustProxyHops: 0,
  sessionSecret: 'secret-de-test-au-moins-trente-deux-caracteres',
  secretProxyInterne: 'secret-proxy-de-test-au-moins-trente-deux-caracteres',
  pgHost: 'localhost',
  pgPort: 5432,
  pgDatabase: 'innov_events_tests',
  pgUser: 'postgres',
  pgPassword: 'test',
  mongodbUrl: 'mongodb://localhost:27017',
  mongodbDatabase: 'innov_events_logs',
};
const proxy = {
  'X-Innov-Proxy-Secret': config.secretProxyInterne,
  'X-Innov-Client-Ip': '192.0.2.90',
};
type Agent = ReturnType<typeof request.agent>;
type Methode = 'get' | 'post' | 'patch' | 'delete';
const routes: [Methode, string, boolean][] = [
  ['get', '/administration/tableau-de-bord', false],
  ['get', '/clients', true],
  ['get', '/themes', true],
  ['get', '/clients/1', true],
  ['post', '/clients', false],
  ['patch', '/clients/1', false],
  ['delete', '/clients/1', false],
  ['get', '/evenements', true],
  ['get', '/evenements/1', true],
  ['post', '/evenements', false],
  ['patch', '/evenements/1', false],
  ['delete', '/evenements/1', false],
  ['get', '/notes-globales', false],
  ['post', '/notes', true],
  ['patch', '/notes/1', true],
  ['delete', '/notes/1', true],
  ['post', '/taches', false],
  ['post', '/taches/1/affectation', false],
  ['post', '/taches/1/statut', true],
  ['get', '/comptes', false],
  ['post', '/comptes', false],
  ['post', '/comptes/1/statut', false],
  ['delete', '/comptes/1', false],
  ['get', '/avis/moderation', true],
  ['post', '/avis/1/moderation', true],
  ['get', '/journaux', false],
];

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'J9 avec PostgreSQL reel et sessions persistantes',
  () => {
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const postgres = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: '-c role=innov_events_app',
    });
    let mails: Courriel[], echecMail: boolean;
    let app: ReturnType<typeof creerApp>, journaux: Journal[], hache: string, idType: number;
    const repository = new GestionRepository(postgres);
    beforeAll(async () => {
      if (!(await admin.query('SELECT current_database() AS nom')).rows[0].nom.endsWith('_tests'))
        throw new Error('Base jetable suffixee _tests obligatoire');
      await admin.query('DROP SCHEMA IF EXISTS innov_events CASCADE');
      await admin.query(
        await readFile(
          new URL('../../../../database/CO-04-script-postgresql.sql', import.meta.url),
          'utf8',
        ),
      );
      await admin.query(
        await readFile(
          new URL('../../../../database/init/03-parametres-et-types.sql', import.meta.url),
          'utf8',
        ),
      );
      idType = (
        await admin.query('SELECT id_type_evenement FROM innov_events.types_evenement LIMIT 1')
      ).rows[0].id_type_evenement;
      hache = await new MotsDePasseService().hacher('Valide1!');
    });
    afterAll(async () => {
      await postgres.end();
      await admin.end();
    });
    beforeEach(async () => {
      await admin.query(
        'TRUNCATE innov_events.utilisateurs,innov_events.clients,innov_events.prospects,innov_events.sessions RESTART IDENTITY CASCADE',
      );
      journaux = [];
      mails = [];
      echecMail = false;
      const collection = {
        insertOne: vi.fn(async (j: Journal) => journaux.push(j)),
        find: vi.fn((filtre: { type_action?: string }) => {
          let debut = 0;
          const curseur = {
            sort: () => curseur,
            skip: (n: number) => {
              debut = n;
              return curseur;
            },
            limit: () => curseur,
            toArray: async () =>
              journaux
                .filter((j) => !filtre.type_action || j.type_action === filtre.type_action)
                .slice(debut, debut + 50),
          };
          return curseur;
        }),
      };
      const mongodb = { db: () => ({ collection: () => collection }) } as unknown as MongoClient;
      app = creerApp({
        postgres,
        mongodb,
        configuration: config,
        courriels: {
          envoyer: async (mail) => {
            if (echecMail) throw new Error('indisponible');
            mails.push(mail);
          },
        },
      });
    });
    async function compte(role = 'admin') {
      const id = (
        await admin.query(
          `INSERT INTO innov_events.utilisateurs(email_connexion,nom_utilisateur,prenom,nom,role,mot_de_passe_hache)
   VALUES($1,$2,'Ada','Durand',$3,$4) RETURNING id_utilisateur::text`,
          [Math.random() + '@example.org', Math.random().toString(), role, hache],
        )
      ).rows[0].id_utilisateur as string;
      const email = (
        await admin.query(
          'SELECT email_connexion FROM innov_events.utilisateurs WHERE id_utilisateur=$1',
          [id],
        )
      ).rows[0].email_connexion;
      return { id, email };
    }
    async function connecter(email: string) {
      const agent = request.agent(app);
      const jeton = (await agent.get('/api/csrf').set(proxy)).body.jeton_csrf as string;
      expect(
        (
          await agent
            .post('/api/sessions')
            .set(proxy)
            .set('X-CSRF-Token', jeton)
            .send({ email_connexion: email, mot_de_passe: 'Valide1!' })
        ).status,
      ).toBe(200);
      return agent;
    }
    async function session(role = 'admin') {
      const u = await compte(role);
      return { ...u, agent: await connecter(u.email) };
    }
    async function appel(a: Agent, m: Methode, p: string, d: unknown = {}) {
      if (m === 'get') return a.get('/api' + p).set(proxy);
      const jeton = (await a.get('/api/csrf').set(proxy)).body.jeton_csrf as string;
      return a[m]('/api' + p)
        .set(proxy)
        .set('X-CSRF-Token', jeton)
        .send(d as object);
    }
    const clientDonnees = {
      entreprise: 'Test SAS',
      nom_contact: 'Martin',
      prenom_contact: 'Lea',
      email_contact: 'lea@example.org',
      telephone: '0600000000',
      adresse_postale: '1 rue du Test, Lyon',
    };
    async function fixture(statut = 'brouillon') {
      const c = await repository.enregistrerClient(clientDonnees);
      const e = (
        await admin.query(
          `INSERT INTO innov_events.evenements(id_client,id_type_evenement,nom,date_debut,date_fin,lieu,statut_evenement)
   VALUES($1,$2,'Salon',NOW()+INTERVAL '1 day',NOW()+INTERVAL '2 days','Lyon',$3) RETURNING id_evenement::text`,
          [c.id_client, idType, statut],
        )
      ).rows[0];
      return { id_client: c.id_client, id_evenement: e.id_evenement as string };
    }
    it.each(['visiteur', 'client', 'employe', 'admin'])(
      'controle chaque route pour %s, y compris heritage employe',
      async (role) => {
        const agent = role === 'visiteur' ? request.agent(app) : (await session(role)).agent;
        for (const [m, p, equipe] of routes) {
          const res = await appel(agent, m, p);
          const autorise = role === 'admin' || (role === 'employe' && equipe);
          if (autorise) expect([200, 201, 400, 404, 409], m + ' ' + p).toContain(res.status);
          else expect(res.status, m + ' ' + p).toBe(role === 'visiteur' ? 401 : 403);
        }
      },
    );
    it('journalise creation modification suppression avec les noms requis', async () => {
      const { agent } = await session();
      const c = await appel(agent, 'post', '/clients', clientDonnees);
      expect(c.status).toBe(201);
      expect(
        (
          await appel(agent, 'patch', '/clients/' + c.body.id_client, {
            ...clientDonnees,
            telephone: '0700000000',
          })
        ).status,
      ).toBe(200);
      expect((await appel(agent, 'delete', '/clients/' + c.body.id_client)).status).toBe(200);
      const actions = journaux.filter((j) => j.type_action.endsWith('_CLIENT'));
      expect(actions.map((j) => j.type_action)).toEqual([
        'CREATION_CLIENT',
        'MODIFICATION_CLIENT',
        'SUPPRESSION_CLIENT',
      ]);
      expect(actions[0]?.details['nom_client']).toBe('Lea Martin');
      expect(actions[2]?.details['nom_client']).toBe('Lea Martin');
      expect((await repository.client(c.body.id_client)).date_anonymisation).toBeTruthy();
    });
    it.each(['client', 'employe'])(
      'detruit toutes les sessions du compte %s suspendu et refuse la connexion',
      async (role) => {
        const gestion = await session(),
          u = await session(role),
          deux = await connecter(u.email);
        expect(
          (
            await admin.query(
              `SELECT 1 FROM innov_events.sessions WHERE sess->'authentification'->>'id_utilisateur'=$1`,
              [u.id],
            )
          ).rowCount,
        ).toBe(2);
        expect(
          (
            await appel(gestion.agent, 'post', '/comptes/' + u.id + '/statut', {
              statut_compte: 'suspendu',
            })
          ).status,
        ).toBe(200);
        expect(
          (
            await admin.query(
              `SELECT 1 FROM innov_events.sessions WHERE sess->'authentification'->>'id_utilisateur'=$1`,
              [u.id],
            )
          ).rowCount,
        ).toBe(0);
        for (const agent of [u.agent, deux])
          expect((await appel(agent, 'get', '/sessions/courante')).status).toBe(401);
        const jeton = (await u.agent.get('/api/csrf').set(proxy)).body.jeton_csrf;
        expect(
          (
            await u.agent
              .post('/api/sessions')
              .set(proxy)
              .set('X-CSRF-Token', jeton)
              .send({ email_connexion: u.email, mot_de_passe: 'Valide1!' })
          ).status,
        ).toBe(401);
        expect(
          (
            await appel(gestion.agent, 'post', '/comptes/' + u.id + '/statut', {
              statut_compte: 'actif',
            })
          ).status,
        ).toBe(200);
        expect((await appel(deux, 'get', '/sessions/courante')).status).toBe(401);
      },
    );
    it('supprime logiquement un employe, garde ses notes et taches terminees et reaffecte les autres', async () => {
      const g = await session(),
        u = await session('employe'),
        f = await fixture();
      const n = await repository.enregistrerNote(
        null,
        f.id_evenement,
        'Note conservée',
        u.id,
        false,
      );
      const t = await repository.creerTache({
        id_evenement: f.id_evenement,
        id_utilisateur: u.id,
        titre: 'A faire',
        description: null,
        date_echeance: null,
      });
      await admin.query(
        `INSERT INTO innov_events.taches(id_evenement,id_utilisateur,titre,statut_tache) VALUES($1,$2,'Finie','termine')`,
        [f.id_evenement, u.id],
      );
      expect((await appel(g.agent, 'delete', '/comptes/' + u.id)).status).toBe(200);
      const compteSupprime = (
        await admin.query(
          'SELECT statut_compte,email_connexion,mot_de_passe_hache FROM innov_events.utilisateurs WHERE id_utilisateur=$1',
          [u.id],
        )
      ).rows[0];
      expect(compteSupprime).toMatchObject({ statut_compte: 'supprime', mot_de_passe_hache: null });
      expect(compteSupprime.email_connexion).toContain('@compte.invalid');
      expect((await repository.notes(f.id_evenement))[0]).toMatchObject({
        id_note: n.id_note,
        id_utilisateur: u.id,
      });
      const taches = await repository.taches(f.id_evenement);
      expect(taches.find((tache) => tache.id_tache === t.id_tache)?.id_utilisateur).toBe(g.id);
      expect(taches.find((tache) => tache.statut_tache === 'termine')?.id_utilisateur).toBe(u.id);
      expect(
        (
          await admin.query(
            `SELECT 1 FROM innov_events.sessions WHERE sess->'authentification'->>'id_utilisateur'=$1`,
            [u.id],
          )
        ).rowCount,
      ).toBe(0);
    });
    it('supprime un compte client en conservant evenements devis avis et retire notes et demandes', async () => {
      const g = await session(),
        u = await session('client'),
        f = await fixture('termine');
      await admin.query('UPDATE innov_events.clients SET id_utilisateur=$2 WHERE id_client=$1', [
        f.id_client,
        u.id,
      ]);
      await repository.enregistrerNote(null, f.id_evenement, 'Note à effacer', g.id, true);
      await admin.query(
        `INSERT INTO innov_events.devis(id_evenement,intitule,taux_tva_applique) VALUES($1,'Devis',20)`,
        [f.id_evenement],
      );
      await admin.query(
        `INSERT INTO innov_events.avis(id_evenement,commentaire,note_evaluation) VALUES($1,'Bien',4)`,
        [f.id_evenement],
      );
      await admin.query(
        `INSERT INTO innov_events.prospects(id_type_evenement,entreprise,nom,prenom,email,telephone,lieu_souhaite,date_souhaitee,nb_participants,description_besoin)
   VALUES($1,'Test','Martin','Lea','LEA@example.org','0600000000','Lyon','2027-01-01',2,'Test')`,
        [idType],
      );
      expect((await appel(g.agent, 'delete', '/comptes/' + u.id)).status).toBe(200);
      const c = await repository.client(f.id_client);
      expect(c).toMatchObject({ id_utilisateur: null, entreprise: null, nom_contact: null });
      expect(c.evenements).toHaveLength(1);
      expect(await repository.notes(f.id_evenement)).toHaveLength(0);
      expect((await admin.query('SELECT 1 FROM innov_events.devis')).rowCount).toBe(1);
      expect(await repository.avis()).toHaveLength(1);
      expect((await admin.query('SELECT 1 FROM innov_events.prospects')).rowCount).toBe(0);
      expect(
        (
          await admin.query('SELECT 1 FROM innov_events.utilisateurs WHERE id_utilisateur=$1', [
            u.id,
          ])
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await admin.query(
            `SELECT 1 FROM innov_events.sessions WHERE sess->'authentification'->>'id_utilisateur'=$1`,
            [u.id],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        journaux.find((j) => j.type_action === 'SUPPRESSION_CLIENT')?.details['nom_client'],
      ).toBe('Lea Martin');
    });
    it('reserve le statut de tache a son affecte meme face a un admin et impose le cycle', async () => {
      const g = await session(),
        u = await session('employe'),
        autre = await session('employe'),
        f = await fixture();
      const t = await appel(g.agent, 'post', '/taches', {
        id_evenement: f.id_evenement,
        id_utilisateur: u.id,
        titre: 'Préparer',
      });
      expect(t.status).toBe(201);
      const p = '/taches/' + t.body.id_tache + '/statut';
      for (const a of [g.agent, autre.agent])
        expect((await appel(a, 'post', p, { statut_tache: 'en_cours' })).status).toBe(403);
      expect((await appel(u.agent, 'post', p, { statut_tache: 'termine' })).status).toBe(409);
      expect((await appel(u.agent, 'post', p, { statut_tache: 'en_cours' })).status).toBe(200);
      expect((await appel(u.agent, 'post', p, { statut_tache: 'termine' })).status).toBe(200);
      expect((await appel(u.agent, 'post', p, { statut_tache: 'en_cours' })).status).toBe(409);
    });
    it('protege les notes des autres auteurs et les notes globales', async () => {
      const g = await session(),
        u = await session('employe'),
        autre = await session('employe'),
        f = await fixture();
      expect((await appel(u.agent, 'post', '/notes', { contenu: 'Interdit' })).status).toBe(403);
      const n = await appel(u.agent, 'post', '/notes', {
        id_evenement: f.id_evenement,
        contenu: 'Travail',
      });
      expect(n.status).toBe(201);
      expect(
        (await appel(autre.agent, 'patch', '/notes/' + n.body.id_note, { contenu: 'Vol' })).status,
      ).toBe(403);
      expect((await appel(autre.agent, 'delete', '/notes/' + n.body.id_note)).status).toBe(403);
      expect(
        (await appel(u.agent, 'patch', '/notes/' + n.body.id_note, { contenu: 'Mis à jour' }))
          .status,
      ).toBe(200);
      expect((await appel(g.agent, 'delete', '/notes/' + n.body.id_note)).status).toBe(200);
      expect((await appel(g.agent, 'post', '/notes', { contenu: 'Globale' })).status).toBe(201);
    });
    it('permet la consultation employe sans modification structurelle et garde historique et recherche', async () => {
      const u = await session('employe'),
        f = await fixture();
      expect((await appel(u.agent, 'get', '/clients?recherche=Martin')).body).toHaveLength(1);
      expect((await appel(u.agent, 'get', '/clients/' + f.id_client)).body.evenements).toHaveLength(
        1,
      );
      expect((await appel(u.agent, 'get', '/evenements/' + f.id_evenement)).body).toMatchObject({
        lieu: 'Lyon',
        statut_evenement: 'brouillon',
      });
      expect((await appel(u.agent, 'delete', '/evenements/' + f.id_evenement)).status).toBe(403);
    });
    it('verifie le tableau de bord, trois prochains tries, cinq notes et clients actifs dedupliques', async () => {
      const g = await session();
      const f = await fixture('en_cours');
      for (let i = 0; i < 7; i++) {
        await fixture();
        await repository.enregistrerNote(null, null, 'Note ' + i, g.id, true);
      }
      await admin.query(
        `INSERT INTO innov_events.evenements(id_client,id_type_evenement,nom,date_debut,date_fin,lieu,statut_evenement)
   VALUES($1,$2,'Second en cours',NOW()-INTERVAL '1 day',NOW()+INTERVAL '1 day','Lyon','en_cours')`,
        [f.id_client, idType],
      );
      const r = await appel(g.agent, 'get', '/administration/tableau-de-bord');
      expect(r.body.prochains_evenements).toHaveLength(3);
      expect(r.body.notes_recentes).toHaveLength(5);
      expect(r.body.clients_actifs).toHaveLength(1);
      expect(r.body.brouillons).toHaveLength(7);
    });
    it('filtre les evenements a venir pour mobile et les trie', async () => {
      const u = await session('employe');
      await fixture('accepte');
      await fixture('annule');
      await fixture('termine');
      const r = await appel(u.agent, 'get', '/evenements?avenir=true');
      expect(r.status).toBe(200);
      expect(r.body).toHaveLength(1);
    });
    it('ne publie que les avis valides apres moderation par employe ou admin', async () => {
      const u = await session('employe'),
        f = await fixture('termine');
      const id = (
        await admin.query(
          `INSERT INTO innov_events.avis(id_evenement,commentaire,note_evaluation) VALUES($1,'Très bien',5) RETURNING id_avis::text`,
          [f.id_evenement],
        )
      ).rows[0].id_avis;
      expect((await request(app).get('/api/avis').set(proxy)).body).toEqual([]);
      expect(
        (await appel(u.agent, 'post', '/avis/' + id + '/moderation', { statut_avis: 'valide' }))
          .status,
      ).toBe(200);
      expect((await request(app).get('/api/avis').set(proxy)).body).toHaveLength(1);
      expect(
        (await appel(u.agent, 'post', '/avis/' + id + '/moderation', { statut_avis: 'refuse' }))
          .status,
      ).toBe(409);
    });
    it('cree les comptes employes et clients sans fuite de hache ni elevation admin', async () => {
      const g = await session(),
        f = await fixture();
      const d = {
        email_connexion: 'nouveau@example.org',
        nom_utilisateur: 'nouveau',
        prenom: 'Jean',
        nom: 'Test',
        role: 'client',
        id_client: f.id_client,
      };
      expect((await appel(g.agent, 'post', '/comptes', d)).status).toBe(201);
      expect((await appel(g.agent, 'post', '/comptes', { ...d, role: 'admin' })).status).toBe(400);
      expect(
        (
          await appel(g.agent, 'post', '/comptes', {
            ...d,
            role: 'employe',
            id_client: null,
            email_connexion: 'employe@example.org',
            nom_utilisateur: 'employe',
          })
        ).status,
      ).toBe(201);
      const liste = await appel(g.agent, 'get', '/comptes');
      expect(JSON.stringify(liste.body)).not.toContain('hache');
      expect((await appel(g.agent, 'delete', '/comptes/' + g.id)).status).toBe(409);
    });
    it.each(['employe', 'client'])(
      'cree un compte %s temporaire par email et impose le renouvellement',
      async (role) => {
        const g = await session();
        const d = {
          email_connexion: 'titulaire@example.org',
          nom_utilisateur: 'titulaire',
          prenom: 'Jean',
          nom: 'Test',
          role,
        };
        const creation = await appel(g.agent, 'post', '/comptes', d);
        expect(creation.status).toBe(201);
        expect(Object.keys(creation.body)).toEqual(['id_utilisateur']);
        expect(mails).toHaveLength(1);
        expect(mails[0]?.destinataire).toBe(d.email_connexion);
        const temporaire = mails[0]!.texte.match(/Mot de passe temporaire : ([^\n]+)/u)![1]!;
        expect(JSON.stringify(creation.body)).not.toContain(temporaire);
        const compte = (
          await admin.query(
            'SELECT mot_de_passe_hache,mdp_temporaire_hache,mdp_temporaire_expire_le FROM innov_events.utilisateurs WHERE id_utilisateur=$1',
            [creation.body.id_utilisateur],
          )
        ).rows[0];
        expect(compte.mot_de_passe_hache).toBeNull();
        expect(
          await new MotsDePasseService().verifier(compte.mdp_temporaire_hache, temporaire),
        ).toBe(true);
        const delai = new Date(compte.mdp_temporaire_expire_le).getTime() - Date.now();
        expect(delai).toBeGreaterThan(6.9 * 86400000);
        expect(delai).toBeLessThanOrEqual(7 * 86400000);
        const agent = request.agent(app),
          jeton = (await agent.get('/api/csrf').set(proxy)).body.jeton_csrf;
        const connexion = await agent
          .post('/api/sessions')
          .set(proxy)
          .set('X-CSRF-Token', jeton)
          .send({ email_connexion: d.email_connexion, mot_de_passe: temporaire });
        expect(connexion.status).toBe(200);
        expect(connexion.body.changement_mdp_requis).toBe(true);
        expect((await appel(agent, 'get', '/evenements')).status).toBe(403);
        expect(
          (await appel(g.agent, 'post', '/comptes', { ...d, mot_de_passe: 'Interdit1!' })).status,
        ).toBe(400);
      },
    );
    it('annule creation et rattachement si le courriel echoue', async () => {
      const g = await session(),
        f = await fixture();
      echecMail = true;
      const d = {
        email_connexion: 'absent@example.org',
        nom_utilisateur: 'absent',
        prenom: 'Jean',
        nom: 'Test',
        role: 'client',
        id_client: f.id_client,
      };
      expect((await appel(g.agent, 'post', '/comptes', d)).status).toBe(503);
      expect(
        (
          await admin.query('SELECT 1 FROM innov_events.utilisateurs WHERE email_connexion=$1', [
            d.email_connexion,
          ])
        ).rowCount,
      ).toBe(0);
      expect((await repository.client(f.id_client)).id_utilisateur).toBeNull();
      expect(mails).toHaveLength(0);
    });
    it('projette les dates de gestion au format ISO avec T', async () => {
      const g = await session(),
        f = await fixture();
      await repository.enregistrerNote(null, f.id_evenement, 'Note', g.id, true);
      await repository.creerTache({
        id_evenement: f.id_evenement,
        id_utilisateur: g.id,
        titre: 'Test',
        description: null,
        date_echeance: '2027-02-01T09:00:00+01:00',
      });
      const e = (await appel(g.agent, 'get', '/evenements/' + f.id_evenement)).body;
      for (const v of [
        e.date_debut,
        e.date_fin,
        e.notes[0].date_creation,
        e.taches[0].date_echeance,
      ]) {
        expect(v).toContain('T');
        expect(Number.isFinite(Date.parse(v))).toBe(true);
      }
    });
    it('modifie les evenements selon le cycle, refuse suppression avec devis et journalise les statuts', async () => {
      const g = await session(),
        f = await fixture();
      const d = {
        nom: 'Modifié',
        id_type_evenement: idType,
        id_theme: null,
        date_debut: '2027-02-01T10:00:00Z',
        date_fin: '2027-02-01T18:00:00Z',
        lieu: 'Paris',
        image_url: null,
        visible_public: false,
      };
      for (const statut of ['accepte', 'en_cours', 'termine'])
        expect(
          (
            await appel(g.agent, 'patch', '/evenements/' + f.id_evenement, {
              ...d,
              statut_evenement: statut,
            })
          ).status,
        ).toBe(200);
      expect(
        (
          await appel(g.agent, 'patch', '/evenements/' + f.id_evenement, {
            ...d,
            statut_evenement: 'annule',
          })
        ).status,
      ).toBe(409);
      await admin.query(
        `INSERT INTO innov_events.devis(id_evenement,intitule,taux_tva_applique) VALUES($1,'Devis',20)`,
        [f.id_evenement],
      );
      expect((await appel(g.agent, 'delete', '/evenements/' + f.id_evenement)).status).toBe(409);
      expect(
        journaux
          .filter((j) => j.type_action === 'CHANGEMENT_STATUT_EVENEMENT')
          .map((j) => j.details['nouveau']),
      ).toEqual(['accepte', 'en_cours', 'termine']);
      const sansDevis = await fixture();
      expect((await appel(g.agent, 'delete', '/evenements/' + sansDevis.id_evenement)).status).toBe(
        200,
      );
    });
    it('filtre les journaux par action et refuse les objets injectes', async () => {
      const g = await session();
      await appel(g.agent, 'post', '/clients', clientDonnees);
      const logs = await appel(g.agent, 'get', '/journaux?type_action=CREATION_CLIENT');
      expect(logs.status).toBe(200);
      expect(logs.body).toHaveLength(1);
      expect((await appel(g.agent, 'get', '/journaux?type_action[$ne]=x')).status).toBe(400);
    });
  },
);
