import { readFile } from 'node:fs/promises';
import session from 'express-session';
import { BSON, type MongoClient } from 'mongodb';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { creerApp } from '../app.js';
import type { Configuration } from '../config/config.js';
import type { Journal } from '../repositories/logs.repository.js';
import { UtilisateursRepository, type Role } from '../repositories/utilisateurs.repository.js';
import { MotsDePasseService } from '../services/mots-de-passe.service.js';
import type { Courriel } from '../services/courriels.service.js';

const configuration: Configuration = {
  port: 3000,
  production: false,
  trustProxyHops: 0,
  sessionSecret: 'un-secret-de-test-d-au-moins-32-caracteres',
  secretProxyInterne: 'secret-proxy-de-test-d-au-moins-32-caracteres',
  pgHost: 'localhost',
  pgPort: 5432,
  pgDatabase: 'innov_events_tests',
  pgUser: 'postgres',
  pgPassword: 'test',
  mongodbUrl: 'mongodb://localhost:27017',
  mongodbDatabase: 'innov_events_logs',
  mailContact: 'contact@example.org',
};
const mdp = 'Valide1!';
const temporaire = 'Temporaire1!';
const adresse = 'client@example.org';
const ip = '192.0.2.10';
const entetes = {
  'X-Innov-Proxy-Secret': configuration.secretProxyInterne,
  'X-Innov-Client-Ip': ip,
};
const donneesInscription = {
  email_connexion: adresse,
  nom_utilisateur: 'camille',
  prenom: 'Camille',
  nom: 'Martin',
  mot_de_passe: mdp,
};

// Exclusivement une base jetable suffixee _tests ; jamais la base de developpement.
describe.skipIf(!process.env.TEST_DATABASE_URL)('J7 avec PostgreSQL reel', () => {
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const postgres = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: '-c role=innov_events_app',
  });
  let hache: string;
  let hacheTemporaire: string;
  let journaux: Journal[];
  let courriels: Courriel[];
  let stockage: session.MemoryStore;
  let app: ReturnType<typeof creerApp>;
  let idType: number;
  const mots = new MotsDePasseService();

  beforeAll(async () => {
    const { rows } = await admin.query<{ nom: string }>('SELECT current_database() AS nom');
    if (!rows[0]?.nom.endsWith('_tests'))
      throw new Error('TEST_DATABASE_URL doit viser une base jetable suffixee _tests');
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
      await admin.query<{ id_type_evenement: number }>(
        'SELECT id_type_evenement FROM innov_events.types_evenement ORDER BY id_type_evenement LIMIT 1',
      )
    ).rows[0]!.id_type_evenement;
    [hache, hacheTemporaire] = await Promise.all([mots.hacher(mdp), mots.hacher(temporaire)]);
  });

  afterAll(async () => {
    await Promise.all([postgres.end(), admin.end()]);
  });

  beforeEach(async () => {
    await admin.query(
      'TRUNCATE innov_events.utilisateurs, innov_events.prospects, innov_events.sessions CASCADE',
    );
    await admin.query(
      "UPDATE innov_events.parametres SET texte_remerciement = 'Merci initial' WHERE id_parametres = 1",
    );
    journaux = [];
    courriels = [];
    stockage = new session.MemoryStore();
    const mongodb = {
      db: vi.fn(() => ({
        collection: vi.fn(() => ({
          insertOne: vi.fn(async (journal: Journal) => {
            journaux.push(journal);
          }),
        })),
      })),
    } as unknown as MongoClient;
    app = creerApp({
      postgres,
      mongodb,
      configuration,
      stockageSession: stockage,
      courriels: {
        envoyer: async (courriel) => {
          courriels.push(courriel);
        },
      },
    });
  });

  const agent = () => request.agent(app);
  type Agent = ReturnType<typeof agent>;
  async function jeton(a: Agent): Promise<string> {
    const r = await a.get('/api/csrf').set(entetes);
    expect(r.status).toBe(200);
    return r.body.jeton_csrf as string;
  }
  async function modifier(
    a: Agent,
    methode: 'post' | 'patch' | 'delete',
    chemin: string,
    donnees: object = {},
  ) {
    const t = await jeton(a);
    return a[methode](chemin).set(entetes).set('X-CSRF-Token', t).send(donnees);
  }
  async function creerCompte(
    role: Role = 'client',
    temp = false,
    sansMdp = false,
  ): Promise<string> {
    return (
      await admin.query<{ id_utilisateur: string }>(
        `INSERT INTO innov_events.utilisateurs
      (email_connexion, nom_utilisateur, prenom, nom, role, mot_de_passe_hache, mdp_temporaire_hache, mdp_temporaire_expire_le)
      VALUES ($1,'camille','Camille','Martin',$2,$3,$4,CASE WHEN $4::text IS NULL THEN NULL ELSE clock_timestamp()+INTERVAL '1 hour' END) RETURNING id_utilisateur::text`,
        [adresse, role, sansMdp ? null : hache, temp ? hacheTemporaire : null],
      )
    ).rows[0]!.id_utilisateur;
  }
  async function connecte(role: Role = 'client', temp = false): Promise<Agent> {
    await creerCompte(role, temp);
    const a = agent();
    expect(
      (
        await modifier(a, 'post', '/api/sessions', {
          email_connexion: adresse,
          mot_de_passe: temp ? temporaire : mdp,
        })
      ).status,
    ).toBe(200);
    return a;
  }
  const demande = () => ({
    entreprise: 'Aster',
    nom: 'Martin',
    prenom: 'Camille',
    email: adresse,
    telephone: '0000000000',
    lieu_souhaite: 'Paris',
    date_souhaitee: '2027-01-28',
    id_type_evenement: idType,
    nb_participants: 80,
    description_besoin: 'Un séminaire.',
  });

  it('inscrit uniquement un client, hache Argon2id et envoie une confirmation sans mot de passe', async () => {
    expect((await modifier(agent(), 'post', '/api/inscriptions', donneesInscription)).status).toBe(
      202,
    );
    const compte = await new UtilisateursRepository(admin).parEmail(adresse);
    expect(compte?.role).toBe('client');
    expect(compte?.mot_de_passe_hache).toMatch(/^\$argon2id\$/);
    expect(await mots.verifier(compte!.mot_de_passe_hache, mdp)).toBe(true);
    expect(courriels).toHaveLength(1);
    expect(courriels[0]?.destinataire).toBe(adresse);
    expect(JSON.stringify(courriels)).not.toContain(mdp);
  });

  it.each(['admin', 'employe'])('refuse l’injection du role %s a l’inscription', async (role) => {
    expect(
      (await modifier(agent(), 'post', '/api/inscriptions', { ...donneesInscription, role }))
        .status,
    ).toBe(400);
    expect((await admin.query('SELECT 1 FROM innov_events.utilisateurs')).rowCount).toBe(0);
  });

  it.each(['Abc1!xy', 'abcdefg1!', 'ABCDEFG1!', 'Abcdefgh!', 'Abcdefg1'])(
    'verifie la complexite cote serveur : %s',
    async (mot_de_passe) => {
      expect(
        (
          await modifier(agent(), 'post', '/api/inscriptions', {
            ...donneesInscription,
            mot_de_passe,
          })
        ).status,
      ).toBe(400);
    },
  );

  it('ne distingue pas une inscription deja existante dans la reponse', async () => {
    const a = agent();
    const premier = await modifier(a, 'post', '/api/inscriptions', donneesInscription);
    const second = await modifier(a, 'post', '/api/inscriptions', donneesInscription);
    expect(second.status).toBe(premier.status);
    expect(second.body).toEqual(premier.body);
    expect(courriels).toHaveLength(1);
  });

  it('regenere le cookie, renouvelle le CSRF et ne renvoie aucun hache', async () => {
    await creerCompte();
    const a = agent();
    const ancien = await jeton(a);
    const connexion = await a
      .post('/api/sessions')
      .set(entetes)
      .set('X-CSRF-Token', ancien)
      .send({ email_connexion: adresse.toUpperCase(), mot_de_passe: mdp });
    expect(connexion.status).toBe(200);
    expect(connexion.headers['set-cookie']).toBeDefined();
    expect(JSON.stringify(connexion.body)).not.toMatch(/hache|preuve|Valide1/u);
    expect((await a.delete('/api/sessions').set(entetes).set('X-CSRF-Token', ancien)).status).toBe(
      403,
    );
    expect((await modifier(a, 'delete', '/api/sessions')).status).toBe(204);
    expect((await a.get('/api/sessions/courante').set(entetes)).status).toBe(401);
  });

  it('ne distingue pas compte inexistant, mot de passe faux et compte suspendu', async () => {
    const a = agent();
    const absent = await modifier(a, 'post', '/api/sessions', {
      email_connexion: adresse,
      mot_de_passe: 'faux',
    });
    await creerCompte();
    const faux = await modifier(a, 'post', '/api/sessions', {
      email_connexion: adresse,
      mot_de_passe: 'faux',
    });
    await admin.query("UPDATE innov_events.utilisateurs SET statut_compte='suspendu'");
    const suspendu = await modifier(a, 'post', '/api/sessions', {
      email_connexion: adresse,
      mot_de_passe: mdp,
    });
    expect(absent.status).toBe(401);
    expect(faux.body).toEqual(absent.body);
    expect(suspendu.body).toEqual(absent.body);
  });

  it('donne une seule reussite a deux connexions temporaires concurrentes, sur PostgreSQL reel', async () => {
    await creerCompte('client', true, true);
    const a = agent();
    const b = agent();
    const [ta, tb] = await Promise.all([jeton(a), jeton(b)]);
    const resultats = await Promise.all([
      a
        .post('/api/sessions')
        .set(entetes)
        .set('X-CSRF-Token', ta)
        .send({ email_connexion: adresse, mot_de_passe: temporaire }),
      b
        .post('/api/sessions')
        .set(entetes)
        .set('X-CSRF-Token', tb)
        .send({ email_connexion: adresse, mot_de_passe: temporaire }),
    ]);
    expect(resultats.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(journaux.map((j) => j.type_action).sort()).toEqual([
      'CONNEXION_ECHOUEE',
      'CONNEXION_REUSSIE',
    ]);
    expect(
      (
        await admin.query(
          'SELECT mdp_temporaire_hache IS NOT NULL AND mdp_temporaire_expire_le <= clock_timestamp() AS consomme FROM innov_events.utilisateurs',
        )
      ).rows[0]?.consomme,
    ).toBe(true);
  });

  it('refuse la reutilisation apres abandon et conserve le mot de passe permanent', async () => {
    await connecte('client', true);
    // Nouvel agent : l'onglet precedent n'est plus utilise, sans deconnexion explicite.
    const b = agent();
    expect(
      (
        await modifier(b, 'post', '/api/sessions', {
          email_connexion: adresse,
          mot_de_passe: temporaire,
        })
      ).status,
    ).toBe(401);
    expect(
      (await modifier(b, 'post', '/api/sessions', { email_connexion: adresse, mot_de_passe: mdp }))
        .status,
    ).toBe(200);
  });

  it.each([
    ['get', '/api/sessions/courante'],
    ['get', '/api/parametres/remerciement'],
    ['get', '/api/types-evenement'],
    ['post', '/api/contacts'],
    ['post', '/api/prospects'],
    ['post', '/api/inscriptions'],
    ['post', '/api/mots-de-passe-oublies'],
    ['post', '/api/sessions'],
    ['patch', '/api/parametres/remerciement'],
  ] as const)('bloque %s %s pour une session restreinte', async (methode, chemin) => {
    const a = await connecte('admin', true);
    const t = await jeton(a);
    const r = await a[methode](chemin).set(entetes).set('X-CSRF-Token', t).send({});
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('CHANGEMENT_MDP_REQUIS');
  });

  it('refuse une session restreinte apres 15 minutes meme si son cookie est presente', async () => {
    const a = await connecte('client', true);
    const t = await jeton(a);
    const sessions = await new Promise<Record<string, session.SessionData>>((resolve, reject) =>
      stockage.all((e, s) => (e ? reject(e) : resolve(s as Record<string, session.SessionData>))),
    );
    const [cle, donnee] = Object.entries(sessions).find(([, s]) => s.authentification)!;
    donnee.authentification!.expire_le = Date.now() - 1;
    await new Promise<void>((resolve, reject) =>
      stockage.set(cle, donnee, (e) => (e ? reject(e) : resolve())),
    );
    expect(
      (
        await a
          .patch('/api/mot-de-passe')
          .set(entetes)
          .set('X-CSRF-Token', t)
          .send({ mot_de_passe: 'Nouveau1!' })
      ).status,
    ).toBe(401);
  });

  it('enregistre le nouveau hache, efface le temporaire et invalide l’ancienne session normale', async () => {
    const ancien = await connecte('client');
    await admin.query(
      "UPDATE innov_events.utilisateurs SET mdp_temporaire_hache=$1, mdp_temporaire_expire_le=clock_timestamp()+INTERVAL '1 hour'",
      [hacheTemporaire],
    );
    const a = agent();
    await modifier(a, 'post', '/api/sessions', {
      email_connexion: adresse,
      mot_de_passe: temporaire,
    });
    expect(
      (await modifier(a, 'patch', '/api/mot-de-passe', { mot_de_passe: 'Nouveau1!' })).status,
    ).toBe(200);
    const compte = await new UtilisateursRepository(admin).parEmail(adresse);
    expect(compte?.mdp_temporaire_hache).toBeNull();
    expect(compte?.mdp_temporaire_expire_le).toBeNull();
    expect(await mots.verifier(compte!.mot_de_passe_hache, 'Nouveau1!')).toBe(true);
    expect((await a.get('/api/sessions/courante').set(entetes)).status).toBe(200);
    expect((await ancien.get('/api/sessions/courante').set(entetes)).status).toBe(401);
  });

  it('une nouvelle demande d’oubli invalide la session restreinte precedente', async () => {
    const a = await connecte('client', true);
    const b = agent();
    await modifier(b, 'post', '/api/mots-de-passe-oublies', { email_connexion: adresse });
    expect((await a.get('/api/csrf').set(entetes)).status).toBe(401);
  });

  it('oubli : meme reponse, expiration une heure, mot de passe permanent conserve', async () => {
    const a = agent();
    const absent = await modifier(a, 'post', '/api/mots-de-passe-oublies', {
      email_connexion: adresse,
    });
    await creerCompte();
    const present = await modifier(a, 'post', '/api/mots-de-passe-oublies', {
      email_connexion: adresse,
    });
    expect(present.status).toBe(202);
    expect(present.body).toEqual(absent.body);
    const compte = await new UtilisateursRepository(admin).parEmail(adresse);
    expect(compte?.mot_de_passe_hache).toBe(hache);
    expect(Date.parse(compte!.mdp_temporaire_expire_le!) - Date.now()).toBeGreaterThan(3590000);
    expect(courriels).toHaveLength(1);
    expect(courriels[0]?.texte).toContain('une seule connexion');
  });

  it.each(['client', 'employe', 'admin'] as const)(
    'controle chaque route protegee pour le role %s',
    async (role) => {
      const a = await connecte(role);
      expect((await a.get('/api/sessions/courante').set(entetes)).status).toBe(200);
      expect((await a.get('/api/parametres/remerciement').set(entetes)).status).toBe(
        role === 'admin' ? 200 : 403,
      );
      expect(
        (
          await modifier(a, 'patch', '/api/parametres/remerciement', {
            texte_remerciement: 'Merci modifié',
          })
        ).status,
      ).toBe(role === 'admin' ? 200 : 403);
      expect(
        (await modifier(a, 'patch', '/api/mot-de-passe', { mot_de_passe: 'Nouveau1!' })).status,
      ).toBe(403);
    },
  );

  it.each([
    ['get', '/api/sessions/courante'],
    ['get', '/api/parametres/remerciement'],
    ['patch', '/api/parametres/remerciement'],
    ['patch', '/api/mot-de-passe'],
  ] as const)('refuse %s %s sans session authentifiee', async (m, chemin) => {
    const a = agent();
    const t = await jeton(a);
    expect(
      (
        await a[m](chemin)
          .set(entetes)
          .set('X-CSRF-Token', t)
          .send(
            chemin === '/api/mot-de-passe'
              ? { mot_de_passe: 'Nouveau1!' }
              : { texte_remerciement: 'Merci' },
          )
      ).status,
    ).toBe(401);
  });

  it('relit le role et le statut : une session n’accorde pas des droits perimes', async () => {
    const a = await connecte('admin');
    await admin.query("UPDATE innov_events.utilisateurs SET role='client'");
    expect((await a.get('/api/parametres/remerciement').set(entetes)).status).toBe(403);
    await admin.query("UPDATE innov_events.utilisateurs SET statut_compte='suspendu'");
    expect((await a.get('/api/sessions/courante').set(entetes)).status).toBe(401);
  });

  it.each([
    ['post', '/api/inscriptions'],
    ['post', '/api/sessions'],
    ['post', '/api/mots-de-passe-oublies'],
    ['patch', '/api/mot-de-passe'],
    ['delete', '/api/sessions'],
    ['post', '/api/contacts'],
    ['post', '/api/prospects'],
    ['patch', '/api/parametres/remerciement'],
  ] as const)('CSRF obligatoire sur %s %s', async (methode, chemin) => {
    expect((await agent()[methode](chemin).set(entetes).send({})).status).toBe(403);
  });

  it('contact : e-mail obligatoire sans identifiant, visiteur et client admis', async () => {
    const a = agent();
    expect(
      (await modifier(a, 'post', '/api/contacts', { titre: 'Question', description: 'Bonjour' }))
        .status,
    ).toBe(400);
    expect(
      (
        await modifier(a, 'post', '/api/contacts', {
          titre: 'Question',
          description: 'Bonjour',
          email: adresse,
        })
      ).status,
    ).toBe(200);
    const b = await connecte();
    expect(
      (
        await modifier(b, 'post', '/api/contacts', {
          titre: 'Question',
          description: 'Bonjour',
          nom_utilisateur: 'camille',
        })
      ).status,
    ).toBe(200);
    expect(courriels).toHaveLength(2);
    expect(courriels.every((c) => c.destinataire === 'contact@example.org')).toBe(true);
  });

  it('devis : statut impose, notification et message admin dans les demandes suivantes', async () => {
    const a = await connecte('admin');
    await modifier(a, 'patch', '/api/parametres/remerciement', {
      texte_remerciement: 'À très bientôt !',
    });
    const reponse = await modifier(agent(), 'post', '/api/prospects', demande());
    expect(reponse.status).toBe(201);
    expect(reponse.body).toEqual({
      texte_remerciement: 'À très bientôt !',
      notification_envoyee: true,
    });
    const { rows } = await admin.query(
      'SELECT statut_prospect, id_client FROM innov_events.prospects',
    );
    expect(rows).toEqual([{ statut_prospect: 'a_contacter', id_client: null }]);
    expect(courriels[0]?.destinataire).toBe('contact@example.org');
  });

  it.each([
    'entreprise',
    'nom',
    'prenom',
    'email',
    'telephone',
    'lieu_souhaite',
    'date_souhaitee',
    'id_type_evenement',
    'nb_participants',
    'description_besoin',
  ] as const)('devis : champ obligatoire %s controle sur le serveur', async (champ) => {
    const d: Record<string, unknown> = demande();
    delete d[champ];
    expect((await modifier(agent(), 'post', '/api/prospects', d)).status).toBe(400);
  });

  it('devis : refuse date impossible, nombre fractionnaire, type absent et injection de statut', async () => {
    for (const d of [
      { ...demande(), date_souhaitee: '2027-02-30' },
      { ...demande(), nb_participants: 1.5 },
      { ...demande(), id_type_evenement: 32000 },
      { ...demande(), statut_prospect: 'converti' },
    ]) {
      expect((await modifier(agent(), 'post', '/api/prospects', d)).status).toBe(400);
    }
  });

  it('journaux : structure identique, BSON Date, IP validee et aucun mot de passe', async () => {
    const a = await connecte();
    await modifier(a, 'post', '/api/sessions', { email_connexion: adresse, mot_de_passe: 'faux' });
    expect(journaux).toHaveLength(2);
    for (const j of journaux) {
      expect(Object.keys(j).sort()).toEqual([
        'details',
        'horodatage',
        'id_utilisateur',
        'type_action',
      ]);
      expect(j.horodatage).toBeInstanceOf(Date);
      expect(BSON.deserialize(BSON.serialize(j))['horodatage']).toBeInstanceOf(Date);
      expect(j.details['ip']).toBe(ip);
    }
    expect(journaux[0]?.id_utilisateur).not.toBeNull();
    expect(journaux[1]?.id_utilisateur).toBeNull();
    expect(journaux[1]?.details['email']).toBe(adresse);
    expect(JSON.stringify(journaux)).not.toMatch(/mot_de_passe|hache|preuve|Valide1/u);
  });

  it('ignore CF-Connecting-IP et X-Forwarded-For forges dans l’API', async () => {
    const a = agent();
    const t = await jeton(a);
    expect(
      (
        await a
          .post('/api/sessions')
          .set(entetes)
          .set('CF-Connecting-IP', '203.0.113.250')
          .set('X-Forwarded-For', '203.0.113.251')
          .set('X-CSRF-Token', t)
          .send({ email_connexion: adresse, mot_de_passe: 'faux' })
      ).status,
    ).toBe(401);
    expect(journaux[0]?.details['ip']).toBe(ip);
    expect(JSON.stringify(journaux)).not.toContain('203.0.113.25');
  });

  it('limitation de connexion fondee sur la meme IP dediee, pas les en-tetes forges', async () => {
    const a = agent();
    const t = await jeton(a);
    for (let i = 0; i < 10; i++)
      expect(
        (
          await a
            .post('/api/sessions')
            .set(entetes)
            .set('CF-Connecting-IP', `203.0.113.${i + 1}`)
            .set('X-CSRF-Token', t)
            .send({ email_connexion: adresse, mot_de_passe: 'faux' })
        ).status,
      ).toBe(401);
    expect(
      (
        await a
          .post('/api/sessions')
          .set(entetes)
          .set('X-CSRF-Token', t)
          .send({ email_connexion: adresse, mot_de_passe: 'faux' })
      ).status,
    ).toBe(429);
  });

  it('le script cree un seul admin et aucune route publique ne le remplace', async () => {
    const comptes = new UtilisateursRepository(admin);
    const d = { ...donneesInscription };
    await comptes.creerAdmin(d, hache);
    await expect(
      comptes.creerAdmin(
        { ...d, email_connexion: 'autre@example.org', nom_utilisateur: 'autre' },
        hache,
      ),
    ).rejects.toThrow();
    expect(
      (await admin.query("SELECT 1 FROM innov_events.utilisateurs WHERE role='admin'")).rowCount,
    ).toBe(1);
    expect(
      (await modifier(agent(), 'post', '/api/utilisateurs', { ...d, role: 'admin' })).status,
    ).toBe(404);
  });
  it('conserve les sessions dans PostgreSQL avec le role applicatif', async () => {
    const mongodb = {
      db: () => ({ collection: () => ({ insertOne: async () => undefined }) }),
    } as unknown as MongoClient;
    app = creerApp({
      postgres,
      mongodb,
      configuration,
      courriels: { envoyer: async () => undefined },
    });
    await creerCompte('client', true, true);
    const a = agent();
    expect(
      (
        await modifier(a, 'post', '/api/sessions', {
          email_connexion: adresse,
          mot_de_passe: temporaire,
        })
      ).status,
    ).toBe(200);
    expect((await admin.query('SELECT 1 FROM innov_events.sessions')).rowCount).toBe(1);
    expect(
      (await modifier(a, 'patch', '/api/mot-de-passe', { mot_de_passe: 'Nouveau1!' })).status,
    ).toBe(200);
    const compte = await new UtilisateursRepository(admin).parEmail(adresse);
    expect(compte?.mdp_temporaire_hache).toBeNull();
    expect(await mots.verifier(compte!.mot_de_passe_hache, 'Nouveau1!')).toBe(true);
    expect((await a.get('/api/sessions/courante').set(entetes)).status).toBe(200);
    await modifier(a, 'delete', '/api/sessions');
    expect((await admin.query('SELECT 1 FROM innov_events.sessions')).rowCount).toBe(0);
  });
});
