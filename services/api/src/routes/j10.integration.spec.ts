import { readFile } from 'node:fs/promises';
import type { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { creerApp } from '../app.js';
import type { Configuration } from '../config/config.js';
import { EspaceClientRepository } from '../repositories/espace-client.repository.js';
import { LogsRepository, type Journal } from '../repositories/logs.repository.js';
import { PurgesRepository } from '../repositories/purges.repository.js';
import { MotsDePasseService } from '../services/mots-de-passe.service.js';
import { PurgesService } from '../services/purges.service.js';

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
  'X-Innov-Client-Ip': '192.0.2.100',
};
type Agent = ReturnType<typeof request.agent>;
type Methode = 'get' | 'post' | 'patch' | 'delete';
type Role = 'visiteur' | 'client' | 'employe' | 'admin';
type Acces = 'public' | Exclude<Role, 'visiteur'>[];

/**
 * Matrice d'acces de toutes les routes de l'API (AUTH-04). « public » : sans session requise.
 * Une route refusee repond 401 au visiteur et 403 a un role connecte non autorise.
 * GET /api/sante (sondes de l'hebergeur) a ses propres tests. PATCH /api/mot-de-passe exige une
 * session ; seule une session restreinte (mot de passe temporaire) peut l'utiliser, ce que
 * verifient les tests de l'authentification.
 * DELETE /api/sessions est appelee en dernier : elle ferme la session de l'agent.
 */
const ROUTES: [Methode, string, Acces][] = [
  ['get', '/csrf', 'public'],
  ['post', '/inscriptions', 'public'],
  ['post', '/sessions', 'public'],
  ['get', '/sessions/courante', ['client', 'employe', 'admin']],
  ['post', '/mots-de-passe-oublies', 'public'],
  ['patch', '/mot-de-passe', ['client', 'employe', 'admin']],
  ['post', '/contacts', 'public'],
  ['get', '/types-evenement', 'public'],
  ['post', '/prospects', 'public'],
  ['get', '/parametres/remerciement', ['admin']],
  ['patch', '/parametres/remerciement', ['admin']],
  ['get', '/prospects', ['admin']],
  ['post', '/prospects/1/conversion', ['admin']],
  ['post', '/prospects/1/echec', ['admin']],
  ['get', '/themes', ['admin', 'employe']],
  ['post', '/evenements', ['admin']],
  ['get', '/devis', ['admin', 'client']],
  ['post', '/devis', ['admin']],
  ['get', '/devis/1', ['admin', 'client']],
  ['get', '/devis/1/pdf', ['admin', 'client']],
  ['post', '/devis/1/envoi', ['admin']],
  ['patch', '/devis/1', ['admin']],
  ['post', '/devis/1/lignes', ['admin']],
  ['post', '/devis/1/reponse', ['client']],
  ['get', '/administration/tableau-de-bord', ['admin']],
  ['get', '/clients', ['admin', 'employe']],
  ['get', '/clients/1', ['admin', 'employe']],
  ['post', '/clients', ['admin']],
  ['patch', '/clients/1', ['admin']],
  ['delete', '/clients/1', ['admin']],
  ['get', '/evenements', ['admin', 'employe']],
  ['get', '/evenements/1', ['admin', 'employe']],
  ['patch', '/evenements/1', ['admin']],
  ['delete', '/evenements/1', ['admin']],
  ['get', '/notes-globales', ['admin']],
  ['post', '/notes', ['admin', 'employe']],
  ['patch', '/notes/1', ['admin', 'employe']],
  ['delete', '/notes/1', ['admin', 'employe']],
  ['post', '/taches', ['admin']],
  ['post', '/taches/1/affectation', ['admin']],
  ['post', '/taches/1/statut', ['admin', 'employe']],
  ['get', '/comptes', ['admin']],
  ['post', '/comptes', ['admin']],
  ['post', '/comptes/1/statut', ['admin']],
  ['delete', '/comptes/1', ['admin']],
  ['get', '/avis/moderation', ['admin', 'employe']],
  ['post', '/avis/1/moderation', ['admin', 'employe']],
  ['get', '/avis', 'public'],
  ['get', '/journaux', ['admin']],
  ['get', '/espace-client', ['client']],
  ['get', '/profil', ['client']],
  ['patch', '/profil', ['client']],
  ['delete', '/profil', ['client']],
  ['get', '/mes-evenements', ['client']],
  ['post', '/mes-evenements/1/avis', ['client']],
  ['post', '/mes-evenements/1/accord-publication', ['client']],
  ['delete', '/mes-evenements/1/accord-publication', ['client']],
  ['get', '/evenements-publics', 'public'],
  ['get', '/evenements-publics/filtres', 'public'],
  ['get', '/evenements-publics/1', 'public'],
  ['delete', '/sessions', 'public'],
];

/** Lecture d'une valeur imbriquee « details.id_client » dans un journal simule. */
function champ(j: Journal, chemin: string): unknown {
  return chemin
    .split('.')
    .reduce<unknown>((v, cle) => (v as Record<string, unknown> | undefined)?.[cle], j);
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces',
  () => {
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const postgres = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: '-c role=innov_events_app',
    });
    let app: ReturnType<typeof creerApp>;
    let journaux: Journal[];
    let mongodb: MongoClient;
    let collection: Record<string, ReturnType<typeof vi.fn>>;
    let hache: string, idType: number, idType2: number, idTheme: number;

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
      await admin.query(
        `INSERT INTO innov_events.themes(libelle) VALUES('Nature'),('Innovation') ON CONFLICT DO NOTHING`,
      );
      const types = (
        await admin.query(
          'SELECT id_type_evenement FROM innov_events.types_evenement ORDER BY id_type_evenement',
        )
      ).rows;
      idType = types[0].id_type_evenement;
      idType2 = types[1].id_type_evenement;
      idTheme = (await admin.query('SELECT id_theme FROM innov_events.themes ORDER BY id_theme'))
        .rows[0].id_theme;
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
      // Collection simulee : memes filtres que ceux utilises par l'API.
      const correspond = (j: Journal, filtre: Record<string, unknown>) =>
        Object.entries(filtre).every(([cle, condition]) => {
          const valeur = champ(j, cle);
          if (condition && typeof condition === 'object') {
            const c = condition as Record<string, unknown>;
            if ('$in' in c) return (c['$in'] as unknown[]).includes(valeur);
            if ('$exists' in c) return (valeur !== undefined) === c['$exists'];
          }
          if (condition instanceof Date)
            return valeur instanceof Date && valeur.getTime() === condition.getTime();
          return valeur === condition;
        });
      collection = {
        insertOne: vi.fn(async (j: Journal) => journaux.push(structuredClone(j))),
        find: vi.fn((filtre: Record<string, unknown>) => {
          const curseur = {
            sort: () => curseur,
            skip: () => curseur,
            limit: () => curseur,
            toArray: async () => journaux.filter((j) => correspond(j, filtre)),
          };
          return curseur;
        }),
        updateMany: vi.fn(async (filtre: Record<string, unknown>) => {
          const cibles = journaux.filter((j) => correspond(j, filtre));
          for (const j of cibles) delete j.details['nom_client'];
          return { modifiedCount: cibles.length };
        }),
        distinct: vi.fn(async (cle: string, filtre: Record<string, unknown>) => [
          ...new Set(journaux.filter((j) => correspond(j, filtre)).map((j) => champ(j, cle))),
        ]),
        deleteMany: vi.fn(async () => ({ deletedCount: 0 })),
        deleteOne: vi.fn(async (filtre: Record<string, unknown>) => {
          const i = journaux.findIndex((j) => correspond(j, filtre));
          if (i >= 0) journaux.splice(i, 1);
          return { deletedCount: i >= 0 ? 1 : 0 };
        }),
      };
      mongodb = { db: () => ({ collection: () => collection }) } as unknown as MongoClient;
      app = creerApp({
        postgres,
        mongodb,
        configuration: config,
        courriels: { envoyer: async () => {} },
      });
    });

    async function compte(role: Exclude<Role, 'visiteur'> = 'client') {
      const r = await admin.query(
        `INSERT INTO innov_events.utilisateurs(email_connexion,nom_utilisateur,prenom,nom,role,mot_de_passe_hache)
        VALUES($1,$2,'Lea','Martin',$3,$4) RETURNING id_utilisateur::text,email_connexion`,
        [
          `u${Math.random().toString(36).slice(2)}@example.org`,
          Math.random().toString(36),
          role,
          hache,
        ],
      );
      return r.rows[0] as { id_utilisateur: string; email_connexion: string };
    }
    async function connecter(email: string) {
      const agent = request.agent(app);
      const jeton = (await agent.get('/api/csrf').set(proxy)).body.jeton_csrf as string;
      const r = await agent
        .post('/api/sessions')
        .set(proxy)
        .set('X-CSRF-Token', jeton)
        .send({ email_connexion: email, mot_de_passe: 'Valide1!' });
      expect(r.status).toBe(200);
      return agent;
    }
    async function session(role: Exclude<Role, 'visiteur'> = 'client') {
      const u = await compte(role);
      return { ...u, agent: await connecter(u.email_connexion) };
    }
    async function appel(a: Agent, m: Methode, p: string, d: unknown = {}) {
      if (m === 'get') return a.get('/api' + p).set(proxy);
      const jeton = (await a.get('/api/csrf').set(proxy)).body.jeton_csrf as string;
      return a[m]('/api' + p)
        .set(proxy)
        .set('X-CSRF-Token', jeton)
        .send(d as object);
    }
    /** Fiche client nominative, rattachee au compte si un identifiant est donne. */
    async function fiche(idUtilisateur: string | null, email = 'contact@example.org') {
      return (
        await admin.query(
          `INSERT INTO innov_events.clients(id_utilisateur,entreprise,nom_contact,prenom_contact,email_contact,telephone,adresse_postale)
          VALUES($1,'Test SAS','Martin','Lea',$2,'0600000000','1 rue du Test, Lyon') RETURNING id_client::text`,
          [idUtilisateur, email],
        )
      ).rows[0].id_client as string;
    }
    async function evenement(
      idClient: string,
      options: {
        statut?: string;
        debut?: string;
        fin?: string;
        visible?: boolean;
        accord?: boolean;
        prospect?: string | null;
        type?: number;
        theme?: number | null;
        nom?: string;
      } = {},
    ) {
      return (
        await admin.query(
          `INSERT INTO innov_events.evenements(id_client,id_prospect,id_type_evenement,id_theme,nom,date_debut,date_fin,lieu,
            statut_evenement,visible_public,date_accord_publication,image_url)
          VALUES($1,$2,$3,$4,$5,${options.debut ?? "NOW()+INTERVAL '10 days'"},${options.fin ?? "NOW()+INTERVAL '11 days'"},
            'Lyon',$6,$7,CASE WHEN $8::boolean THEN NOW() END,'https://images.example.org/salon.jpg')
          RETURNING id_evenement::text`,
          [
            idClient,
            options.prospect ?? null,
            options.type ?? idType,
            options.theme ?? null,
            options.nom ?? 'Salon',
            options.statut ?? 'accepte',
            options.visible ?? false,
            options.accord ?? false,
          ],
        )
      ).rows[0].id_evenement as string;
    }
    async function prospect(
      email: string,
      options: { statut?: string; client?: string | null; contact?: string | null } = {},
    ) {
      return (
        await admin.query(
          `INSERT INTO innov_events.prospects(id_client,id_type_evenement,entreprise,nom,prenom,email,telephone,
            lieu_souhaite,date_souhaitee,nb_participants,description_besoin,statut_prospect,date_dernier_contact)
          VALUES($1,$2,'Test SAS','Martin','Lea',$3,'0600000000','Lyon','2027-03-01',20,'Besoin',$4,
            ${options.contact ?? 'NULL'}) RETURNING id_prospect::text`,
          [options.client ?? null, idType, email, options.statut ?? 'a_contacter'],
        )
      ).rows[0].id_prospect as string;
    }
    const nbSessions = async (id: string) =>
      (
        await admin.query(
          `SELECT 1 FROM innov_events.sessions WHERE sess->'authentification'->>'id_utilisateur'=$1`,
          [id],
        )
      ).rowCount;

    describe('matrice d acces de toutes les routes', () => {
      it.each(['visiteur', 'client', 'employe', 'admin'] as Role[])(
        'applique le code attendu a chaque route pour le role %s',
        async (role) => {
          const agent = role === 'visiteur' ? request.agent(app) : (await session(role)).agent;
          const ecarts: string[] = [];
          for (const [m, p, acces] of ROUTES) {
            const res = await appel(agent, m, p);
            const autorise = acces === 'public' || (role !== 'visiteur' && acces.includes(role));
            const ok = autorise
              ? [200, 201, 202, 204, 400, 404, 409].includes(res.status)
              : res.status === (role === 'visiteur' ? 401 : 403);
            if (!ok) ecarts.push(`${m.toUpperCase()} /api${p} -> ${res.status}`);
          }
          expect(ecarts).toEqual([]);
        },
      );
      it('couvre chaque route declaree par les routeurs de l API', async () => {
        const sources = await Promise.all(
          [
            'authentification',
            'formulaires',
            'devis',
            'gestion',
            'espace-client',
            'evenements-publics',
          ].map((nom) => readFile(new URL(`./${nom}.routes.ts`, import.meta.url), 'utf8')),
        );
        const declarees = sources
          .flatMap((s) => [
            ...s.matchAll(/\b(?:r|routes)\.(get|post|patch|delete)\(\s*'([^']+)'/gu),
          ])
          .map(([, m, p]) => `${m} ${p!.replace(/:id/gu, '1')}`)
          .sort();
        const testees = ROUTES.filter(([, p]) => p !== '/csrf')
          .map(([m, p]) => `${m} ${p}`)
          .sort();
        expect(testees).toEqual(declarees);
      });
    });

    describe('espace client', () => {
      it('presente les 3 prochains evenements et le suivi des demandes rattachees seulement', async () => {
        const u = await session();
        const idClient = await fiche(u.id_utilisateur);
        const autre = await fiche(null, 'autre@example.org');
        const idProspect = await prospect('contact@example.org', {
          statut: 'converti',
          client: idClient,
          contact: 'NOW()',
        });
        await prospect('autre@example.org', {
          statut: 'converti',
          client: autre,
          contact: 'NOW()',
        });
        await prospect(u.email_connexion);
        const lie = await evenement(idClient, {
          prospect: idProspect,
          debut: "NOW()+INTERVAL '5 days'",
          fin: "NOW()+INTERVAL '6 days'",
          nom: 'Premier',
        });
        for (const [jours, statut] of [
          [20, 'brouillon'],
          [30, 'accepte'],
          [40, 'en_cours'],
          [2, 'annule'],
        ] as const)
          await evenement(idClient, {
            statut,
            debut: `NOW()+INTERVAL '${jours} days'`,
            fin: `NOW()+INTERVAL '${jours + 1} days'`,
            nom: `J${jours}`,
          });
        await evenement(idClient, {
          statut: 'termine',
          debut: "NOW()-INTERVAL '9 days'",
          fin: "NOW()-INTERVAL '8 days'",
        });
        await evenement(autre, { debut: "NOW()+INTERVAL '1 day'", fin: "NOW()+INTERVAL '2 days'" });
        await admin.query(
          `INSERT INTO innov_events.devis(id_evenement,intitule,taux_tva_applique,statut_devis,date_envoi)
          VALUES($1,'Formule envoyée',20,'etude_client',NOW()),($1,'Brouillon interne',20,'en_preparation',NULL)`,
          [lie],
        );
        const r = await appel(u.agent, 'get', '/espace-client');
        expect(r.status).toBe(200);
        expect(r.body.prochains_evenements.map((e: { nom: string }) => e.nom)).toEqual([
          'Premier',
          'J20',
          'J30',
        ]);
        expect(r.body.prochains_evenements[0].date_debut).toMatch(/T/u);
        expect(r.body.suivi).toHaveLength(1);
        expect(r.body.suivi[0]).toMatchObject({
          id_prospect: idProspect,
          statut_prospect: 'converti',
          libelle_type: 'Séminaire',
          evenement: { id_evenement: lie, nom: 'Premier', statut_evenement: 'accepte' },
        });
        expect(r.body.suivi[0].evenement.devis).toEqual([
          expect.objectContaining({ intitule: 'Formule envoyée', statut_devis: 'etude_client' }),
        ]);
        expect(JSON.stringify(r.body)).not.toContain('autre@example.org');
      });
      it('renvoie des listes vides pour un compte sans fiche client', async () => {
        const u = await session();
        await prospect(u.email_connexion);
        const r = await appel(u.agent, 'get', '/espace-client');
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ prochains_evenements: [], suivi: [] });
        expect((await appel(u.agent, 'get', '/mes-evenements')).body).toEqual([]);
        expect((await appel(u.agent, 'get', '/profil')).body.fiche).toBeNull();
      });
      it('refuse en 404 l evenement d un autre client', async () => {
        const u = await session();
        await fiche(u.id_utilisateur);
        const autre = await fiche(null, 'autre@example.org');
        const e = await evenement(autre, { statut: 'termine' });
        expect((await appel(u.agent, 'get', '/mes-evenements')).body).toEqual([]);
        expect(
          (
            await appel(u.agent, 'post', `/mes-evenements/${e}/avis`, {
              note_evaluation: 5,
              commentaire: 'Bien',
            })
          ).status,
        ).toBe(404);
        expect(
          (await appel(u.agent, 'post', `/mes-evenements/${e}/accord-publication`)).status,
        ).toBe(404);
        expect(
          (await appel(u.agent, 'delete', `/mes-evenements/${e}/accord-publication`)).status,
        ).toBe(404);
      });
      it('modifie le profil avec les controles de saisie, de doublon et de mot de passe', async () => {
        const u = await session();
        const idClient = await fiche(u.id_utilisateur);
        const deja = await compte();
        const profil = (await appel(u.agent, 'get', '/profil')).body;
        expect(profil).toEqual({
          compte: {
            prenom: 'Lea',
            nom: 'Martin',
            nom_utilisateur: expect.any(String),
            email_connexion: u.email_connexion,
          },
          fiche: {
            entreprise: 'Test SAS',
            prenom_contact: 'Lea',
            nom_contact: 'Martin',
            email_contact: 'contact@example.org',
            telephone: '0600000000',
            adresse_postale: '1 rue du Test, Lyon',
          },
        });
        expect(JSON.stringify(profil)).not.toContain('hache');
        expect((await appel(u.agent, 'patch', '/profil', {})).status).toBe(400);
        expect(
          (
            await appel(u.agent, 'patch', '/profil', {
              compte: { ...profil.compte, email_connexion: 'pas-un-email' },
            })
          ).status,
        ).toBe(400);
        expect(
          (
            await appel(u.agent, 'patch', '/profil', {
              compte: { ...profil.compte, role: 'admin' },
            })
          ).status,
        ).toBe(400);
        const doublon = await appel(u.agent, 'patch', '/profil', {
          compte: {
            ...profil.compte,
            nom_utilisateur: (
              await admin.query(
                'SELECT nom_utilisateur FROM innov_events.utilisateurs WHERE id_utilisateur=$1',
                [deja.id_utilisateur],
              )
            ).rows[0].nom_utilisateur,
          },
        });
        expect(doublon.status).toBe(409);
        const nouvelEmail = {
          compte: { ...profil.compte, email_connexion: 'Nouvelle@Example.org' },
        };
        const sansMot = await appel(u.agent, 'patch', '/profil', nouvelEmail);
        expect(sansMot.status).toBe(400);
        expect(sansMot.body.code).toBe('MOT_DE_PASSE_ACTUEL_INVALIDE');
        expect(
          (
            await appel(u.agent, 'patch', '/profil', {
              ...nouvelEmail,
              mot_de_passe_actuel: 'Faux1!xx',
            })
          ).status,
        ).toBe(400);
        expect(
          (
            await appel(u.agent, 'patch', '/profil', {
              compte: { ...profil.compte, email_connexion: deja.email_connexion },
              mot_de_passe_actuel: 'Valide1!',
            })
          ).status,
        ).toBe(409);
        const ok = await appel(u.agent, 'patch', '/profil', {
          ...nouvelEmail,
          mot_de_passe_actuel: 'Valide1!',
        });
        expect(ok.status).toBe(200);
        expect(ok.body.compte.email_connexion).toBe('nouvelle@example.org');
        // Changer seulement le prenom ne demande pas le mot de passe ; la fiche n'est pas journalisee.
        expect(
          (
            await appel(u.agent, 'patch', '/profil', {
              compte: { ...ok.body.compte, prenom: 'Léa' },
            })
          ).status,
        ).toBe(200);
        expect(journaux.filter((j) => j.type_action === 'MODIFICATION_CLIENT')).toHaveLength(0);
        // Fiche identique : aucun journal ; fiche modifiee : journal avec l'identifiant seul.
        expect((await appel(u.agent, 'patch', '/profil', { fiche: profil.fiche })).status).toBe(
          200,
        );
        expect(journaux.filter((j) => j.type_action === 'MODIFICATION_CLIENT')).toHaveLength(0);
        const modif = await appel(u.agent, 'patch', '/profil', {
          fiche: { ...profil.fiche, telephone: '0700000000' },
        });
        expect(modif.status).toBe(200);
        expect(modif.body.fiche.telephone).toBe('0700000000');
        const j = journaux.filter((x) => x.type_action === 'MODIFICATION_CLIENT');
        expect(j).toHaveLength(1);
        expect(j[0]).toMatchObject({
          id_utilisateur: u.id_utilisateur,
          details: { id_client: idClient },
        });
        expect(j[0]!.details['nom_client']).toBeUndefined();
        expect(
          (
            await appel(u.agent, 'patch', '/profil', {
              fiche: { ...profil.fiche, adresse_postale: '' },
            })
          ).status,
        ).toBe(400);
      });
      it('refuse la modification de coordonnees pour un compte sans fiche', async () => {
        const u = await session();
        const r = await appel(u.agent, 'patch', '/profil', {
          fiche: {
            entreprise: 'X',
            prenom_contact: 'A',
            nom_contact: 'B',
            email_contact: 'a@example.org',
            telephone: '01',
            adresse_postale: 'Lyon',
          },
        });
        expect(r.status).toBe(409);
      });
      it('accepte un seul avis, seulement sur un evenement termine, en attente de moderation', async () => {
        const u = await session();
        const idClient = await fiche(u.id_utilisateur);
        const enCours = await evenement(idClient, { statut: 'en_cours' });
        const termine = await evenement(idClient, { statut: 'termine' });
        const avis = { note_evaluation: 4, commentaire: '  Très bonne organisation.  ' };
        expect((await appel(u.agent, 'post', `/mes-evenements/${enCours}/avis`, avis)).status).toBe(
          409,
        );
        for (const invalide of [
          { ...avis, note_evaluation: 6 },
          { ...avis, note_evaluation: 0 },
          { ...avis, note_evaluation: 3.5 },
          { ...avis, note_evaluation: '4' },
          { ...avis, commentaire: '   ' },
          { ...avis, commentaire: 'x'.repeat(2001) },
          { ...avis, statut_avis: 'valide' },
        ])
          expect(
            (await appel(u.agent, 'post', `/mes-evenements/${termine}/avis`, invalide)).status,
          ).toBe(400);
        const cree = await appel(u.agent, 'post', `/mes-evenements/${termine}/avis`, {
          ...avis,
          commentaire: ' ' + 'x'.repeat(2000) + ' ',
        });
        expect(cree.status).toBe(201);
        expect(cree.body.statut_avis).toBe('en_attente');
        expect((await appel(u.agent, 'post', `/mes-evenements/${termine}/avis`, avis)).status).toBe(
          409,
        );
        const liste = (await appel(u.agent, 'get', '/mes-evenements')).body;
        expect(
          liste.find((e: { id_evenement: string }) => e.id_evenement === termine).avis,
        ).toMatchObject({ note_evaluation: 4, statut_avis: 'en_attente' });
        // Moderation par l'equipe, puis publication sans nom de client (EMP-05, PUB-09).
        expect((await request(app).get('/api/avis').set(proxy)).body).toEqual([]);
        const employe = await session('employe');
        expect(
          (
            await appel(employe.agent, 'post', `/avis/${cree.body.id_avis}/moderation`, {
              statut_avis: 'valide',
            })
          ).status,
        ).toBe(200);
        const publics = (await request(app).get('/api/avis').set(proxy)).body;
        expect(publics).toHaveLength(1);
        expect(publics[0]).toMatchObject({ note_evaluation: 4, evenement: 'Salon' });
        expect(publics[0].date_creation).toMatch(/T/u);
        const texte = JSON.stringify(publics);
        for (const interdit of ['Martin', 'Lea', 'Test SAS', 'contact@example.org'])
          expect(texte).not.toContain(interdit);
      });
      it('donne puis retire l accord de publication en conservant la premiere date', async () => {
        const u = await session();
        const e = await evenement(await fiche(u.id_utilisateur), { visible: true });
        const premier = await appel(u.agent, 'post', `/mes-evenements/${e}/accord-publication`);
        expect(premier.status).toBe(200);
        expect(premier.body.date_accord_publication).toMatch(/T/u);
        await new Promise((r) => setTimeout(r, 20));
        const second = await appel(u.agent, 'post', `/mes-evenements/${e}/accord-publication`);
        expect(second.body.date_accord_publication).toBe(premier.body.date_accord_publication);
        expect((await request(app).get(`/api/evenements-publics/${e}`).set(proxy)).status).toBe(
          200,
        );
        const retrait = await appel(u.agent, 'delete', `/mes-evenements/${e}/accord-publication`);
        expect(retrait.status).toBe(200);
        expect(retrait.body).toEqual({ date_accord_publication: null });
        expect((await request(app).get(`/api/evenements-publics/${e}`).set(proxy)).status).toBe(
          404,
        );
        const liste = (await appel(u.agent, 'get', '/mes-evenements')).body;
        expect(liste[0]).toMatchObject({ date_accord_publication: null, visible_public: true });
      });
    });

    describe('effacement demande par le client', () => {
      it('efface le compte, anonymise la fiche, detruit les sessions et retire le nom des journaux', async () => {
        const u = await session();
        const deuxieme = await connecter(u.email_connexion);
        const idClient = await fiche(u.id_utilisateur, 'Contact@Example.org');
        const autre = await fiche(null, 'autre@example.org');
        const idProspect = await prospect('contact@example.org', {
          statut: 'converti',
          client: idClient,
          contact: 'NOW()',
        });
        await prospect('CONTACT@example.org');
        await prospect(u.email_connexion.toUpperCase());
        const conserve = await prospect('inconnu@example.org');
        const e = await evenement(idClient, { statut: 'termine', prospect: idProspect });
        const employe = await compte('employe');
        await admin.query(
          `INSERT INTO innov_events.notes(id_evenement,id_utilisateur,contenu) VALUES($1,$2,'Note')`,
          [e, employe.id_utilisateur],
        );
        await admin.query(
          `INSERT INTO innov_events.devis(id_evenement,intitule,taux_tva_applique,statut_devis,date_envoi)
          VALUES($1,'Devis',20,'accepte',NOW())`,
          [e],
        );
        await admin.query(
          `INSERT INTO innov_events.avis(id_evenement,commentaire,note_evaluation,statut_avis) VALUES($1,'Bien',5,'valide')`,
          [e],
        );
        const ancien = new Date(Date.now() - 86_400_000);
        journaux.push(
          {
            horodatage: ancien,
            type_action: 'CREATION_CLIENT',
            id_utilisateur: '1',
            details: { id_client: idClient, nom_client: 'Lea Martin' },
          },
          {
            horodatage: ancien,
            type_action: 'CREATION_CLIENT',
            id_utilisateur: '1',
            details: { id_client: autre, nom_client: 'Autre Client' },
          },
        );
        expect(await nbSessions(u.id_utilisateur)).toBe(2);
        expect((await appel(u.agent, 'delete', '/profil', {})).status).toBe(400);
        expect(
          (await appel(u.agent, 'delete', '/profil', { mot_de_passe: 'Faux1!xx' })).status,
        ).toBe(400);
        expect(await nbSessions(u.id_utilisateur)).toBe(2);

        const r = await appel(u.agent, 'delete', '/profil', { mot_de_passe: 'Valide1!' });
        expect(r.status).toBe(200);
        expect(String(r.headers['set-cookie'])).toContain('innov.sid=;');
        expect(
          (
            await admin.query('SELECT 1 FROM innov_events.utilisateurs WHERE id_utilisateur=$1', [
              u.id_utilisateur,
            ])
          ).rowCount,
        ).toBe(0);
        const anonyme = (
          await admin.query(
            'SELECT id_utilisateur,entreprise,email_contact,date_anonymisation FROM innov_events.clients WHERE id_client=$1',
            [idClient],
          )
        ).rows[0];
        expect(anonyme).toMatchObject({
          id_utilisateur: null,
          entreprise: null,
          email_contact: null,
        });
        expect(anonyme.date_anonymisation).toBeTruthy();
        expect(await nbSessions(u.id_utilisateur)).toBe(0);
        expect(
          (await admin.query('SELECT id_prospect::text FROM innov_events.prospects')).rows,
        ).toEqual([{ id_prospect: conserve }]);
        expect((await admin.query('SELECT 1 FROM innov_events.evenements')).rowCount).toBe(1);
        expect((await admin.query('SELECT 1 FROM innov_events.devis')).rowCount).toBe(1);
        expect((await admin.query('SELECT 1 FROM innov_events.avis')).rowCount).toBe(1);
        expect((await admin.query('SELECT 1 FROM innov_events.notes')).rowCount).toBe(0);
        const effacement = journaux.find((j) => j.type_action === 'EFFACEMENT_CLIENT');
        expect(effacement).toMatchObject({
          id_utilisateur: u.id_utilisateur,
          details: { id_client: idClient },
        });
        expect(JSON.stringify(effacement)).not.toContain('Martin');
        const creations = journaux.filter((j) => j.type_action === 'CREATION_CLIENT');
        expect(creations[0]!.details).toEqual({ id_client: idClient });
        expect(creations[1]!.details['nom_client']).toBe('Autre Client');
        // Sessions fermees et connexion refusee ensuite.
        for (const agent of [u.agent, deuxieme])
          expect((await appel(agent, 'get', '/sessions/courante')).status).toBe(401);
        const jeton = (await deuxieme.get('/api/csrf').set(proxy)).body.jeton_csrf;
        expect(
          (
            await deuxieme
              .post('/api/sessions')
              .set(proxy)
              .set('X-CSRF-Token', jeton)
              .send({ email_connexion: u.email_connexion, mot_de_passe: 'Valide1!' })
          ).status,
        ).toBe(401);
      });
      it('supprime un compte sans fiche et ses demandes non converties', async () => {
        const u = await session();
        await prospect(u.email_connexion);
        const r = await appel(u.agent, 'delete', '/profil', { mot_de_passe: 'Valide1!' });
        expect(r.status).toBe(200);
        expect((await admin.query('SELECT 1 FROM innov_events.utilisateurs')).rowCount).toBe(0);
        expect((await admin.query('SELECT 1 FROM innov_events.prospects')).rowCount).toBe(0);
        expect(journaux.find((j) => j.type_action === 'EFFACEMENT_CLIENT')?.details).toEqual({
          id_client: null,
        });
      });
      it('consigne un echec MongoDB sans donnee personnelle puis la purge rejoue le retrait', async () => {
        const u = await session();
        const idClient = await fiche(u.id_utilisateur);
        journaux.push({
          horodatage: new Date(),
          type_action: 'CREATION_CLIENT',
          id_utilisateur: '1',
          details: { id_client: idClient, nom_client: 'Lea Martin' },
        });
        const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        collection.updateMany!.mockRejectedValueOnce(new Error('MongoDB indisponible'));
        expect(
          (await appel(u.agent, 'delete', '/profil', { mot_de_passe: 'Valide1!' })).status,
        ).toBe(200);
        expect(erreurs).toHaveBeenCalledWith(
          JSON.stringify({ evenement: 'retrait_nom_journaux_echec' }),
        );
        expect(String(erreurs.mock.calls)).not.toContain('Martin');
        const creation = journaux.find((j) => j.type_action === 'CREATION_CLIENT')!;
        expect(creation.details['nom_client']).toBe('Lea Martin');
        erreurs.mockRestore();
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const bilan = await new PurgesService(
          new PurgesRepository(postgres),
          new LogsRepository(mongodb, config.mongodbDatabase),
        ).executer();
        info.mockRestore();
        expect(bilan?.noms_retires).toBe(1);
        expect(creation.details).toEqual({ id_client: idClient });
      });
      it('refuse l effacement sans rien supprimer si MongoDB est entierement indisponible, puis l accepte au retablissement', async () => {
        const u = await session();
        const idClient = await fiche(u.id_utilisateur);
        const demande = await prospect(u.email_connexion);
        journaux.push({
          horodatage: new Date(),
          type_action: 'CREATION_CLIENT',
          id_utilisateur: '1',
          details: { id_client: idClient, nom_client: 'Lea Martin' },
        });
        const creation = journaux.find((j) => j.type_action === 'CREATION_CLIENT')!;
        // Panne simultanee de l'ecriture du journal et du retrait du nom.
        const panne = new Error('MongoDB indisponible');
        collection.insertOne!.mockRejectedValue(panne);
        collection.updateMany!.mockRejectedValue(panne);
        const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const refus = await appel(u.agent, 'delete', '/profil', { mot_de_passe: 'Valide1!' });
        expect(refus.status).toBe(503);
        expect(refus.body.code).toBe('EFFACEMENT_INDISPONIBLE');
        expect(erreurs).toHaveBeenCalledWith(
          JSON.stringify({ evenement: 'journal_indisponible', type_action: 'EFFACEMENT_CLIENT' }),
        );
        expect(String(erreurs.mock.calls)).not.toContain('Martin');
        erreurs.mockRestore();
        // Rien n'est efface : compte, session, fiche nominative, demande et nom des journaux.
        expect(
          (
            await admin.query('SELECT 1 FROM innov_events.utilisateurs WHERE id_utilisateur=$1', [
              u.id_utilisateur,
            ])
          ).rowCount,
        ).toBe(1);
        expect(
          (
            await admin.query(
              'SELECT entreprise,date_anonymisation FROM innov_events.clients WHERE id_client=$1',
              [idClient],
            )
          ).rows[0],
        ).toEqual({ entreprise: 'Test SAS', date_anonymisation: null });
        expect(
          (
            await admin.query('SELECT 1 FROM innov_events.prospects WHERE id_prospect=$1', [
              demande,
            ])
          ).rowCount,
        ).toBe(1);
        expect(await nbSessions(u.id_utilisateur)).toBe(1);
        expect(journaux.some((j) => j.type_action === 'EFFACEMENT_CLIENT')).toBe(false);
        expect(creation.details['nom_client']).toBe('Lea Martin');
        expect((await appel(u.agent, 'get', '/profil')).status).toBe(200);

        // MongoDB retabli : la meme demande aboutit et le nom est retire.
        collection.insertOne!.mockImplementation(async (j: Journal) =>
          journaux.push(structuredClone(j)),
        );
        collection.updateMany!.mockImplementation(async (filtre: Record<string, unknown>) => {
          const cibles = journaux.filter(
            (j) =>
              (filtre['details.id_client'] as { $in: unknown[] }).$in.includes(
                j.details['id_client'],
              ) && j.details['nom_client'] !== undefined,
          );
          for (const j of cibles) delete j.details['nom_client'];
          return { modifiedCount: cibles.length };
        });
        expect(
          (await appel(u.agent, 'delete', '/profil', { mot_de_passe: 'Valide1!' })).status,
        ).toBe(200);
        expect(journaux.find((j) => j.type_action === 'EFFACEMENT_CLIENT')?.details).toEqual({
          id_client: idClient,
        });
        expect(creation.details).toEqual({ id_client: idClient });
        expect(
          (
            await admin.query(
              'SELECT date_anonymisation FROM innov_events.clients WHERE id_client=$1',
              [idClient],
            )
          ).rows[0].date_anonymisation,
        ).toBeTruthy();
      });
      it('retire le journal d effacement si la transaction echoue, sans rien supprimer', async () => {
        const u = await session();
        const idClient = await fiche(u.id_utilisateur);
        const echec = vi
          .spyOn(EspaceClientRepository.prototype, 'effacer')
          .mockRejectedValueOnce(new Error('PostgreSQL indisponible'));
        const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const r = await appel(u.agent, 'delete', '/profil', { mot_de_passe: 'Valide1!' });
        erreurs.mockRestore();
        echec.mockRestore();
        expect(r.status).toBe(500);
        expect(collection.deleteOne).toHaveBeenCalledTimes(1);
        expect(journaux.some((j) => j.type_action === 'EFFACEMENT_CLIENT')).toBe(false);
        expect(
          (
            await admin.query(
              'SELECT date_anonymisation FROM innov_events.clients WHERE id_client=$1',
              [idClient],
            )
          ).rows[0].date_anonymisation,
        ).toBeNull();
        expect(await nbSessions(u.id_utilisateur)).toBe(1);
      });
      it('ne reprend dans la purge que les journaux d effacement d une fiche anonymisee', async () => {
        const g = await session('admin');
        const idClient = await fiche(null);
        // Journal d'effacement reste orphelin (base et MongoDB en panne au meme moment).
        journaux.push(
          {
            horodatage: new Date(),
            type_action: 'EFFACEMENT_CLIENT',
            id_utilisateur: '99',
            details: { id_client: idClient },
          },
          {
            horodatage: new Date(),
            type_action: 'CREATION_CLIENT',
            id_utilisateur: g.id_utilisateur,
            details: { id_client: idClient, nom_client: 'Lea Martin' },
          },
        );
        const creation = journaux.find((j) => j.type_action === 'CREATION_CLIENT')!;
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const purge = new PurgesService(
          new PurgesRepository(postgres),
          new LogsRepository(mongodb, config.mongodbDatabase),
        );
        expect((await purge.executer())?.noms_retires).toBe(0);
        expect(creation.details['nom_client']).toBe('Lea Martin');
        // Une fois la fiche anonymisee, la reprise s'applique.
        await admin.query('SELECT innov_events.supprimer_compte_client($1)', [idClient]);
        expect((await purge.executer())?.noms_retires).toBe(1);
        expect(creation.details).toEqual({ id_client: idClient });
        info.mockRestore();
      });
      it('supprime un compte sans fiche meme si MongoDB est indisponible', async () => {
        const u = await session();
        collection.insertOne!.mockRejectedValue(new Error('MongoDB indisponible'));
        const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(
          (await appel(u.agent, 'delete', '/profil', { mot_de_passe: 'Valide1!' })).status,
        ).toBe(200);
        expect(erreurs).toHaveBeenCalledWith(
          JSON.stringify({ evenement: 'journal_indisponible', type_action: 'EFFACEMENT_CLIENT' }),
        );
        erreurs.mockRestore();
        expect((await admin.query('SELECT 1 FROM innov_events.utilisateurs')).rowCount).toBe(0);
      });
      it('laisse inchange le parcours de l administratrice : le nom reste dans son journal', async () => {
        const g = await session('admin');
        const u = await compte();
        const idClient = await fiche(u.id_utilisateur);
        expect((await appel(g.agent, 'delete', `/clients/${idClient}`)).status).toBe(200);
        const suppression = journaux.find((j) => j.type_action === 'SUPPRESSION_CLIENT');
        expect(suppression?.details).toEqual({ id_client: idClient, nom_client: 'Lea Martin' });
        expect(journaux.some((j) => j.type_action === 'EFFACEMENT_CLIENT')).toBe(false);
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        await new PurgesService(
          new PurgesRepository(postgres),
          new LogsRepository(mongodb, config.mongodbDatabase),
        ).executer();
        info.mockRestore();
        expect(suppression?.details['nom_client']).toBe('Lea Martin');
      });
    });

    describe('catalogue public des evenements', () => {
      async function catalogue() {
        const c = await fiche(null);
        const publie = { visible: true, accord: true };
        return {
          accepte: await evenement(c, { ...publie, nom: 'Publie accepte', theme: idTheme }),
          annule: await evenement(c, {
            ...publie,
            statut: 'annule',
            nom: 'Publie annule',
            type: idType2,
            debut: "NOW()-INTERVAL '40 days'",
            fin: "NOW()-INTERVAL '39 days'",
          }),
          brouillon: await evenement(c, { ...publie, statut: 'brouillon', nom: 'Brouillon' }),
          sansAccord: await evenement(c, { visible: true, nom: 'Sans accord' }),
          invisible: await evenement(c, { accord: true, nom: 'Invisible' }),
        };
      }
      it('ne publie que les evenements visibles, avec accord et hors brouillon, sans prix', async () => {
        const ids = await catalogue();
        await admin.query(
          `INSERT INTO innov_events.devis(id_evenement,intitule,taux_tva_applique) VALUES($1,'Devis secret',20)`,
          [ids.accepte],
        );
        const r = await request(app).get('/api/evenements-publics').set(proxy);
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ total: 2, page: 1, par_page: 12 });
        expect(r.body.evenements.map((e: { nom: string }) => e.nom)).toEqual([
          'Publie accepte',
          'Publie annule',
        ]);
        expect(Object.keys(r.body.evenements[0]).sort()).toEqual(
          [
            'date_debut',
            'date_fin',
            'id_evenement',
            'image_url',
            'libelle_theme',
            'libelle_type',
            'lieu',
            'nom',
            'statut_evenement',
          ].sort(),
        );
        expect(r.body.evenements[1]).toMatchObject({ statut_evenement: 'annule' });
        const texte = JSON.stringify(r.body);
        for (const interdit of [
          'montant',
          'prix',
          'devis',
          'Devis secret',
          'Test SAS',
          'telephone',
        ])
          expect(texte).not.toContain(interdit);
        expect(
          (await request(app).get(`/api/evenements-publics/${ids.annule}`).set(proxy)).body,
        ).toMatchObject({ nom: 'Publie annule', libelle_type: 'Conférence', libelle_theme: null });
        for (const id of [ids.brouillon, ids.sansAccord, ids.invisible, '999'])
          expect((await request(app).get(`/api/evenements-publics/${id}`).set(proxy)).status).toBe(
            404,
          );
      });
      it('filtre par periode, type et theme, trie et pagine', async () => {
        const ids = await catalogue();
        const liste = async (q: string) =>
          (
            await request(app)
              .get('/api/evenements-publics' + q)
              .set(proxy)
          ).body;
        expect(
          (await liste(`?type=${idType2}`)).evenements.map(
            (e: { id_evenement: string }) => e.id_evenement,
          ),
        ).toEqual([ids.annule]);
        expect((await liste(`?theme=${idTheme}`)).evenements).toHaveLength(1);
        expect((await liste(`?theme=${idTheme}&type=${idType2}`)).total).toBe(0);
        expect((await liste('?tri=ancien')).evenements[0].id_evenement).toBe(ids.annule);
        expect((await liste('?tri=recent')).evenements[0].id_evenement).toBe(ids.accepte);
        // Champs du formulaire laisses vides : valeurs par defaut.
        expect(await liste('?du=&au=&type=&theme=&tri=&page=')).toMatchObject({
          total: 2,
          page: 1,
        });
        const jour = (decalage: number) =>
          new Date(Date.now() + decalage * 86_400_000).toISOString().slice(0, 10);
        expect((await liste(`?du=${jour(-45)}&au=${jour(-30)}`)).total).toBe(1);
        expect((await liste(`?du=${jour(-39)}`)).total).toBe(2);
        expect((await liste(`?du=${jour(5)}`)).total).toBe(1);
        expect((await liste(`?au=${jour(-41)}`)).total).toBe(0);
        // Chevauchement : un evenement qui commence avant la periode et finit dedans est retenu.
        expect((await liste(`?du=${jour(-39)}&au=${jour(-39)}`)).total).toBe(1);
        const c = await fiche(null, 'pagination@example.org');
        for (let i = 0; i < 12; i++)
          await evenement(c, {
            visible: true,
            accord: true,
            nom: `Page ${i}`,
            debut: `NOW()+INTERVAL '${100 + i} days'`,
            fin: `NOW()+INTERVAL '${101 + i} days'`,
          });
        const p1 = await liste('');
        expect(p1.evenements).toHaveLength(12);
        expect(p1.total).toBe(14);
        const p2 = await liste('?page=2');
        expect(p2.evenements).toHaveLength(2);
        expect(p2.page).toBe(2);
        const p3 = await liste('?page=3');
        expect(p3).toMatchObject({ evenements: [], total: 14 });
        const filtres = await liste('/filtres');
        expect(filtres.types.map((t: { libelle: string }) => t.libelle)).toContain('Séminaire');
        expect(filtres.themes.map((t: { libelle: string }) => t.libelle)).toEqual([
          'Innovation',
          'Nature',
        ]);
      });
      it.each([
        '?du=2026-02-31',
        '?du=17/11/2026',
        '?au=2026-1-1',
        '?du=2026-12-01&au=2026-11-01',
        '?type=abc',
        '?type=0',
        '?theme=-1',
        '?tri=prix',
        '?page=0',
        '?page=10000',
        '?prix=1',
        '?du=2026-01-01&du=2026-02-01',
      ])('refuse le parametre invalide %s', async (q) => {
        expect(
          (
            await request(app)
              .get('/api/evenements-publics' + q)
              .set(proxy)
          ).status,
        ).toBe(400);
      });
      it('refuse un identifiant de detail invalide', async () => {
        expect((await request(app).get('/api/evenements-publics/abc').set(proxy)).status).toBe(400);
      });
    });

    describe('purges automatiques', () => {
      it('supprime les demandes echouees de plus de 3 ans et conserve les autres', async () => {
        const vieille = await prospect('a@example.org', {
          statut: 'echoue',
          contact: "NOW()-INTERVAL '3 years 1 day'",
        });
        const recente = await prospect('b@example.org', {
          statut: 'echoue',
          contact: "NOW()-INTERVAL '3 years'+INTERVAL '1 day'",
        });
        const aContacter = await prospect('c@example.org', {
          contact: "NOW()-INTERVAL '5 years'",
        });
        await admin.query(
          `UPDATE innov_events.prospects SET date_demande=NOW()-INTERVAL '5 years' WHERE id_prospect=$1`,
          [aContacter],
        );
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const bilan = await new PurgesService(
          new PurgesRepository(postgres),
          new LogsRepository(mongodb, config.mongodbDatabase),
        ).executer();
        expect(info).toHaveBeenCalledWith(
          expect.stringContaining('"evenement":"purges_terminees"'),
        );
        info.mockRestore();
        expect(bilan?.prospects_supprimes).toBe(1);
        const restants = (
          await admin.query('SELECT id_prospect::text FROM innov_events.prospects ORDER BY 1')
        ).rows.map((p) => p.id_prospect);
        expect(restants).toEqual([recente, aContacter].sort());
        expect(restants).not.toContain(vieille);
      });
      it('supprime les journaux de plus d un an hors connexions, sans arreter les autres etapes', async () => {
        const maintenant = new Date('2026-11-17T10:00:00.000Z');
        collection.deleteMany!.mockResolvedValueOnce({ deletedCount: 3 });
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const service = new PurgesService(
          new PurgesRepository(postgres),
          new LogsRepository(mongodb, config.mongodbDatabase),
          () => new Date(maintenant),
        );
        expect((await service.executer())?.journaux_supprimes).toBe(3);
        expect(collection.deleteMany).toHaveBeenCalledWith({
          type_action: { $nin: ['CONNEXION_REUSSIE', 'CONNEXION_ECHOUEE'] },
          horodatage: { $lt: new Date('2025-11-17T10:00:00.000Z') },
        });
        const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        collection.distinct!.mockRejectedValueOnce(new Error('MongoDB indisponible'));
        const bilan = await service.executer();
        expect(bilan).toEqual({
          prospects_supprimes: 0,
          noms_retires: null,
          journaux_supprimes: 0,
        });
        expect(erreurs).toHaveBeenCalledWith(
          JSON.stringify({ evenement: 'purge_echec', etape: 'retrait_noms_journaux' }),
        );
        erreurs.mockRestore();
        info.mockRestore();
      });
    });

    describe('evenements a venir du mobile', () => {
      it('garde un evenement commence et pas fini, exclut un evenement fini', async () => {
        const employe = await session('employe');
        const c = await fiche(null);
        const enCours = await evenement(c, {
          statut: 'en_cours',
          debut: "NOW()-INTERVAL '1 day'",
          fin: "NOW()+INTERVAL '1 day'",
        });
        await evenement(c, {
          statut: 'accepte',
          debut: "NOW()-INTERVAL '3 days'",
          fin: "NOW()-INTERVAL '2 days'",
        });
        const futur = await evenement(c);
        await evenement(c, { statut: 'annule' });
        const r = await appel(employe.agent, 'get', '/evenements?avenir=true');
        expect(r.status).toBe(200);
        expect(r.body.map((e: { id_evenement: string }) => e.id_evenement)).toEqual([
          enCours,
          futur,
        ]);
      });
    });
  },
);
