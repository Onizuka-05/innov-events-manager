import { readFile } from 'node:fs/promises';
import session from 'express-session';
import type { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { creerApp } from '../app.js';
import type { Configuration } from '../config/config.js';
import { DevisRepository } from '../repositories/devis.repository.js';
import type { Journal } from '../repositories/logs.repository.js';
import type { Courriel } from '../services/courriels.service.js';
import { MotsDePasseService } from '../services/mots-de-passe.service.js';
import { ErreurHttp } from '../http/erreur-http.js';

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
  mailContact: 'contact@example.org',
};
const proxy = {
  'X-Innov-Proxy-Secret': config.secretProxyInterne,
  'X-Innov-Client-Ip': '192.0.2.20',
};

/** Ce groupe recree le schema uniquement dans une base jetable suffixee _tests. */
describe.skipIf(!process.env.TEST_DATABASE_URL)('J8 avec PostgreSQL reel', () => {
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const postgres = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: '-c role=innov_events_app',
  });
  const repository = new DevisRepository(postgres);
  const mots = new MotsDePasseService();
  let idType: number;
  let app: ReturnType<typeof creerApp>;
  let courriels: Courriel[];
  let journaux: Journal[];
  let simulerEchecEnvoi: boolean;

  beforeAll(async () => {
    const resultat = await admin.query<{ nom: string }>('SELECT current_database() AS nom');
    if (!resultat.rows[0]?.nom.endsWith('_tests')) throw new Error('Base de test obligatoire');
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
        'SELECT id_type_evenement FROM innov_events.types_evenement LIMIT 1',
      )
    ).rows[0]!.id_type_evenement;
  });
  afterAll(async () => {
    await postgres.end();
    await admin.end();
  });

  beforeEach(async () => {
    await admin.query(
      'TRUNCATE innov_events.sessions, innov_events.utilisateurs, innov_events.prospects CASCADE',
    );
    courriels = [];
    journaux = [];
    simulerEchecEnvoi = false;
    const mongodb = {
      db: vi.fn(() => ({
        collection: vi.fn(() => ({
          insertOne: vi.fn(async (j: Journal) => {
            journaux.push(j);
          }),
        })),
      })),
    } as unknown as MongoClient;
    app = creerApp({
      postgres,
      mongodb,
      configuration: config,
      stockageSession: new session.MemoryStore(),
      courriels: {
        envoyer: async (mail) => {
          if (simulerEchecEnvoi) throw new ErreurHttp(503, 'Envoi indisponible.');
          courriels.push(mail);
        },
      },
    });
  });

  async function prospect(email = 'ada@example.org'): Promise<string> {
    return (
      await admin.query<{ id_prospect: string }>(
        `INSERT INTO innov_events.prospects
      (id_type_evenement,entreprise,nom,prenom,email,telephone,lieu_souhaite,date_souhaitee,nb_participants,description_besoin)
      VALUES ($1,'Entreprise','Durand','Ada',$2,'0600000000','Paris','2027-01-20',12,'Evenement test') RETURNING id_prospect::text`,
        [idType, email],
      )
    ).rows[0]!.id_prospect;
  }
  async function fixture() {
    const id = await prospect();
    const client = await repository.convertir(id, '1 rue du Test, Paris');
    const evenement = await repository.creerEvenement({
      id_client: client.id_client,
      id_prospect: id,
      id_type_evenement: idType,
      id_theme: null,
      nom: 'Session',
      date_debut: '2027-01-20T09:00:00Z',
      date_fin: '2027-01-20T17:00:00Z',
      lieu: 'Paris',
      statut_evenement: 'brouillon',
      image_url: null,
      visible_public: false,
    });
    const devis = await repository.creerDevis(evenement, 'Formule A');
    return { id, idClient: client.id_client, evenement, devis };
  }
  async function compte(idClient: string, email: string) {
    const hache = await mots.hacher('Valide1!');
    const resultat = await admin.query<{ id_utilisateur: string }>(
      `INSERT INTO innov_events.utilisateurs
      (email_connexion,nom_utilisateur,prenom,nom,role,mot_de_passe_hache)
      VALUES ($1,$2,'Ada','Durand','client',$3) RETURNING id_utilisateur::text`,
      [email, `test-${Math.random().toString(36).slice(2)}`, hache],
    );
    await admin.query('UPDATE innov_events.clients SET id_utilisateur=$2 WHERE id_client=$1', [
      idClient,
      resultat.rows[0]!.id_utilisateur,
    ]);
    return resultat.rows[0]!.id_utilisateur;
  }

  async function connecte(email: string, role: 'client' | 'employe' | 'admin', idClient?: string) {
    const hache = await mots.hacher('Valide1!');
    const id = (
      await admin.query<{ id_utilisateur: string }>(
        `INSERT INTO innov_events.utilisateurs
      (email_connexion,nom_utilisateur,prenom,nom,role,mot_de_passe_hache)
      VALUES ($1,$2,'Ada','Durand',$3,$4) RETURNING id_utilisateur::text`,
        [email, `test-${Math.random().toString(36).slice(2)}`, role, hache],
      )
    ).rows[0]!.id_utilisateur;
    if (idClient)
      await admin.query('UPDATE innov_events.clients SET id_utilisateur=$2 WHERE id_client=$1', [
        idClient,
        id,
      ]);
    const agent = request.agent(app);
    const csrf = await agent.get('/api/csrf').set(proxy);
    expect(csrf.status).toBe(200);
    const connexion = await agent
      .post('/api/sessions')
      .set(proxy)
      .set('X-CSRF-Token', csrf.body.jeton_csrf as string)
      .send({ email_connexion: email, mot_de_passe: 'Valide1!' });
    expect(connexion.status).toBe(200);
    return { agent, id };
  }
  async function csrf(agent: ReturnType<typeof request.agent>): Promise<string> {
    const resultat = await agent.get('/api/csrf').set(proxy);
    expect(resultat.status).toBe(200);
    return resultat.body.jeton_csrf as string;
  }
  async function envoyerRequete(
    agent: ReturnType<typeof request.agent>,
    methode: 'get' | 'post' | 'patch',
    chemin: string,
  ) {
    if (methode === 'get') return agent.get(chemin).set(proxy);
    return agent[methode](chemin)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(agent))
      .send({});
  }
  it('controle chaque route administrateur pour les roles client et employe', async () => {
    const routes: { methode: 'get' | 'post' | 'patch'; chemin: string }[] = [
      { methode: 'get', chemin: '/api/prospects' },
      { methode: 'post', chemin: '/api/prospects/1/conversion' },
      { methode: 'post', chemin: '/api/prospects/1/echec' },
      { methode: 'post', chemin: '/api/evenements' },
      { methode: 'post', chemin: '/api/devis' },
      { methode: 'patch', chemin: '/api/devis/1' },
      { methode: 'post', chemin: '/api/devis/1/lignes' },
      { methode: 'post', chemin: '/api/devis/1/envoi' },
    ];
    for (const role of ['client', 'employe'] as const) {
      const { agent } = await connecte(`${role}@example.org`, role);
      for (const { methode, chemin } of routes) {
        expect(
          (await envoyerRequete(agent, methode, chemin)).status,
          `${role} ${methode.toUpperCase()} ${chemin}`,
        ).toBe(403);
      }
    }
  });
  it('refuse la consultation du devis a un employe', async () => {
    const { agent } = await connecte('employe@example.org', 'employe');
    for (const chemin of ['/api/devis', '/api/devis/1', '/api/devis/1/pdf']) {
      expect((await agent.get(chemin).set(proxy)).status, chemin).toBe(403);
    }
  });
  it('refuse la reponse a un devis a un employe et a un administrateur', async () => {
    for (const role of ['admin', 'employe'] as const) {
      const { agent } = await connecte(`${role}@example.org`, role);
      expect((await envoyerRequete(agent, 'post', '/api/devis/1/reponse')).status).toBe(403);
    }
  });
  it('cache le devis du client A au client B y compris le PDF et la reponse', async () => {
    const f = await fixture();
    await connecte('ada@example.org', 'client', f.idClient);
    const { agent } = await connecte('autre@example.org', 'client');
    await repository.remplacerLignes(f.devis, [
      { libelle_prestation: 'Accueil', montant_ht: 125.5 },
    ]);
    await repository.preparerEnvoi(f.devis, async () => {});
    expect((await agent.get(`/api/devis/${f.devis}`).set(proxy)).status).toBe(404);
    expect((await agent.get(`/api/devis/${f.devis}/pdf`).set(proxy)).status).toBe(404);
    const csrf = await agent.get('/api/csrf').set(proxy);
    expect(
      (
        await agent
          .post(`/api/devis/${f.devis}/reponse`)
          .set(proxy)
          .set('X-CSRF-Token', csrf.body.jeton_csrf as string)
          .send({ choix: 'accepte' })
      ).status,
    ).toBe(404);
  });
  it('refuse toutes les routes sensibles sans session', async () => {
    const chemins = [
      '/api/prospects',
      '/api/clients',
      '/api/evenements',
      '/api/themes',
      '/api/devis',
      '/api/devis/1',
      '/api/devis/1/pdf',
    ];
    for (const chemin of chemins)
      expect((await request(app).get(chemin).set(proxy)).status).toBe(401);
  });
  it('interdit toute mutation sans jeton CSRF', async () => {
    expect((await request(app).post('/api/devis').set(proxy).send({})).status).toBe(403);
  });
  it('interdit la conversion d un prospect echoue', async () => {
    const id = await prospect();
    await repository.echouer(id, async () => {});
    await expect(repository.convertir(id, '1 rue du Test')).rejects.toMatchObject({ statut: 409 });
  });
  it('ne duplique pas une conversion simultanee', async () => {
    const id = await prospect();
    const resultat = await Promise.allSettled([
      repository.convertir(id, '1 rue'),
      repository.convertir(id, '1 rue'),
    ]);
    expect(resultat.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('refuse un devis en preparation au client rattache', async () => {
    const f = await fixture();
    const id = await compte(f.idClient, 'ada@example.org');
    expect(await repository.possede(f.devis, id)).toBe(false);
  });
  it('accepte une reponse et refuse les autres devis dans la transaction', async () => {
    const f = await fixture();
    const autre = await repository.creerDevis(f.evenement, 'Formule B');
    const id = await compte(f.idClient, 'ada@example.org');
    await repository.remplacerLignes(f.devis, [
      { libelle_prestation: 'Accueil', montant_ht: 125.5 },
    ]);
    await repository.remplacerLignes(autre, [{ libelle_prestation: 'Salle', montant_ht: 200 }]);
    await repository.preparerEnvoi(f.devis, async () => {});
    await repository.preparerEnvoi(autre, async () => {});
    expect(await repository.repondre(f.devis, id, 'accepte', '')).toBe(true);
    expect((await repository.detail(autre)).statut_devis).toBe('refuse');
    expect((await repository.detail(f.devis)).statut_devis).toBe('accepte');
  });
  it('refuse un brouillon jamais envoye a l acceptation et le masque au client', async () => {
    const f = await fixture();
    const brouillon = await repository.creerDevis(f.evenement, 'Formule brouillon');
    const id = await compte(f.idClient, 'ada@example.org');
    await repository.remplacerLignes(f.devis, [
      { libelle_prestation: 'Accueil', montant_ht: 125.5 },
    ]);
    await repository.preparerEnvoi(f.devis, async () => {});
    expect(await repository.repondre(f.devis, id, 'accepte', '')).toBe(true);
    const refuse = await repository.detail(brouillon);
    expect(refuse.statut_devis).toBe('refuse');
    expect(refuse.date_envoi).toBeNull();
    expect(await repository.possede(brouillon, id)).toBe(false);
    expect(await repository.possede(f.devis, id)).toBe(true);
    const visibles = (await repository.liste(id, 'client')).map((d) => d.id_devis);
    expect(visibles).toEqual([f.devis]);
  });
  it('rattache une seconde demande du meme e-mail a la fiche existante, puis envoie le devis', async () => {
    const f = await fixture();
    await compte(f.idClient, 'ada@example.org');
    const id = await prospect('ADA@example.org');
    // L'adresse d'une demande n'est pas verifiee : sans confirmation de la fiche, rien n'est rattache.
    await expect(repository.convertir(id, '9 autre adresse')).rejects.toMatchObject({
      statut: 409,
      code: 'RATTACHEMENT_A_CONFIRMER',
    });
    const enAttente = await admin.query(
      'SELECT statut_prospect,id_client FROM innov_events.prospects WHERE id_prospect=$1',
      [id],
    );
    expect(enAttente.rows[0]).toEqual({ statut_prospect: 'a_contacter', id_client: null });
    const conversion = await repository.convertir(id, '9 autre adresse', f.idClient);
    expect(conversion).toMatchObject({ id_client: f.idClient, cree: false });
    const fiches = await admin.query<{ n: string; adresse: string }>(
      'SELECT count(*)::text AS n, max(adresse_postale) AS adresse FROM innov_events.clients',
    );
    expect(fiches.rows[0]).toEqual({ n: '1', adresse: '1 rue du Test, Paris' });
    const evenement = await repository.creerEvenement({
      id_client: f.idClient,
      id_prospect: id,
      id_type_evenement: idType,
      id_theme: null,
      nom: 'Seconde session',
      date_debut: '2027-02-20T09:00:00Z',
      date_fin: '2027-02-20T17:00:00Z',
      lieu: 'Paris',
      statut_evenement: 'brouillon',
      image_url: null,
      visible_public: false,
    });
    const devis = await repository.creerDevis(evenement, 'Formule B');
    await repository.remplacerLignes(devis, [{ libelle_prestation: 'Salle', montant_ht: 300 }]);
    const { agent } = await connecte('admin@example.org', 'admin');
    const envoi = await agent
      .post(`/api/devis/${devis}/envoi`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(agent))
      .send({});
    expect(envoi.status).toBe(200);
    expect(courriels.at(-1)?.destinataire).toBe('ada@example.org');
    expect(courriels.at(-1)?.texte).not.toContain('Mot de passe temporaire');
  });
  it('laisse la demande a contacter si le message de classement echoue, puis accepte un nouvel essai', async () => {
    const id = await prospect();
    const { agent } = await connecte('admin@example.org', 'admin');
    const classer = async () =>
      agent
        .post(`/api/prospects/${id}/echec`)
        .set(proxy)
        .set('X-CSRF-Token', await csrf(agent))
        .send({ message: 'Nous ne pouvons pas donner suite.' });
    simulerEchecEnvoi = true;
    expect((await classer()).status).toBe(503);
    const statut = async () =>
      (
        await admin.query<{ statut_prospect: string }>(
          'SELECT statut_prospect FROM innov_events.prospects WHERE id_prospect=$1',
          [id],
        )
      ).rows[0]!.statut_prospect;
    expect(await statut()).toBe('a_contacter');
    expect(journaux.some((j) => j.type_action === 'ECHEC_PROSPECT')).toBe(false);
    simulerEchecEnvoi = false;
    expect((await classer()).status).toBe(200);
    expect(await statut()).toBe('echoue');
    expect(courriels).toHaveLength(1);
    expect(journaux.some((j) => j.type_action === 'ECHEC_PROSPECT')).toBe(true);
  });
  it('garde l acceptation et trace l echec de la notification a Innov Events', async () => {
    const f = await fixture();
    await repository.remplacerLignes(f.devis, [{ libelle_prestation: 'Accueil', montant_ht: 100 }]);
    await repository.preparerEnvoi(f.devis, async () => {});
    const { agent } = await connecte('ada@example.org', 'client', f.idClient);
    const trace = vi.spyOn(console, 'info').mockImplementation(() => {});
    simulerEchecEnvoi = true;
    const reponse = await agent
      .post(`/api/devis/${f.devis}/reponse`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(agent))
      .send({ choix: 'accepte' });
    simulerEchecEnvoi = false;
    expect(reponse.status).toBe(200);
    expect((await repository.detail(f.devis)).statut_devis).toBe('accepte');
    expect(trace).toHaveBeenCalledWith(
      JSON.stringify({ evenement: 'notification_acceptation_echouee', id_devis: f.devis }),
    );
    trace.mockRestore();
  });
  it('envoie le PDF, cree le compte temporaire et journalise le devis', async () => {
    const f = await fixture();
    const { agent } = await connecte('admin@example.org', 'admin');
    await repository.remplacerLignes(f.devis, [
      { libelle_prestation: 'Accueil', montant_ht: 125.5 },
    ]);
    const csrf = await agent.get('/api/csrf').set(proxy);
    const resultat = await agent
      .post(`/api/devis/${f.devis}/envoi`)
      .set(proxy)
      .set('X-CSRF-Token', csrf.body.jeton_csrf as string)
      .send({});
    expect(resultat.status).toBe(200);
    expect((await repository.detail(f.devis)).statut_devis).toBe('etude_client');
    expect(courriels).toHaveLength(1);
    expect(courriels[0]?.piecesJointes?.[0]?.contenu.subarray(0, 4).toString()).toBe('%PDF');
    expect(courriels[0]?.texte).toContain('Mot de passe temporaire');
    const nouveau = await admin.query<{ mdp_temporaire_expire_le: Date }>(
      `SELECT u.mdp_temporaire_expire_le
      FROM innov_events.clients c JOIN innov_events.utilisateurs u USING(id_utilisateur)
      WHERE c.id_client=$1`,
      [f.idClient],
    );
    expect(nouveau.rows[0]?.mdp_temporaire_expire_le).toBeTruthy();
    expect(
      journaux.some((j) => j.type_action === 'ENVOI_DEVIS' && typeof j.id_utilisateur === 'string'),
    ).toBe(true);
  });
  it('annule le compte et le statut si le courriel du devis echoue', async () => {
    const f = await fixture();
    const { agent } = await connecte('admin@example.org', 'admin');
    await repository.remplacerLignes(f.devis, [
      { libelle_prestation: 'Accueil', montant_ht: 125.5 },
    ]);
    simulerEchecEnvoi = true;
    const resultat = await agent
      .post(`/api/devis/${f.devis}/envoi`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(agent))
      .send({});
    expect(resultat.status).toBe(503);
    expect((await repository.detail(f.devis)).statut_devis).toBe('en_preparation');
    const fiche = await admin.query<{ id_utilisateur: string | null }>(
      'SELECT id_utilisateur::text FROM innov_events.clients WHERE id_client=$1',
      [f.idClient],
    );
    expect(fiche.rows[0]?.id_utilisateur).toBeNull();
    const compte = await admin.query(
      'SELECT 1 FROM innov_events.utilisateurs WHERE email_connexion=$1',
      ['ada@example.org'],
    );
    expect(compte.rowCount).toBe(0);
    expect(courriels).toHaveLength(0);
  });
  it('remplace le mot de passe d un compte inscrit avec l e-mail du contact avant de le rattacher', async () => {
    // Bertrand s'est inscrit avec l'adresse d'Ada sans la verifier : il connait le mot de passe.
    const f = await fixture();
    const bertrand = await connecte('ada@example.org', 'client');
    await repository.remplacerLignes(f.devis, [{ libelle_prestation: 'Salle', montant_ht: 110 }]);
    const { agent } = await connecte('admin@example.org', 'admin');
    const resultat = await agent
      .post(`/api/devis/${f.devis}/envoi`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(agent))
      .send({});
    expect(resultat.status).toBe(200);
    const fiche = await admin.query<{ id_utilisateur: string }>(
      'SELECT id_utilisateur::text FROM innov_events.clients WHERE id_client=$1',
      [f.idClient],
    );
    expect(fiche.rows[0]?.id_utilisateur).toBe(bertrand.id);
    const compteRattache = await admin.query<{
      mot_de_passe_hache: string | null;
      mdp_temporaire_hache: string | null;
    }>(
      'SELECT mot_de_passe_hache,mdp_temporaire_hache FROM innov_events.utilisateurs WHERE id_utilisateur=$1',
      [bertrand.id],
    );
    expect(compteRattache.rows[0]?.mot_de_passe_hache).toBeNull();
    expect(compteRattache.rows[0]?.mdp_temporaire_hache).toBeTruthy();
    // Le temporaire part a l'adresse de contact, que seul son titulaire lit.
    expect(courriels).toHaveLength(1);
    expect(courriels[0]?.destinataire).toBe('ada@example.org');
    expect(courriels[0]?.texte).toContain('Mot de passe temporaire');
    // La session de Bertrand et son ancien mot de passe ne donnent plus acces au devis.
    expect((await bertrand.agent.get('/api/sessions/courante').set(proxy)).status).toBe(401);
    expect((await bertrand.agent.get(`/api/devis/${f.devis}`).set(proxy)).status).toBe(401);
    const reconnexion = await bertrand.agent
      .post('/api/sessions')
      .set(proxy)
      .set('X-CSRF-Token', await csrf(bertrand.agent))
      .send({ email_connexion: 'ada@example.org', mot_de_passe: 'Valide1!' });
    expect(reconnexion.status).toBe(401);
  });
  it('reutilise le compte deja rattache si son email differe du contact', async () => {
    const f = await fixture();
    const utilisateur = await compte(f.idClient, 'connexion@example.org');
    const { agent } = await connecte('admin@example.org', 'admin');
    await repository.remplacerLignes(f.devis, [{ libelle_prestation: 'Salle', montant_ht: 110 }]);
    const resultat = await agent
      .post(`/api/devis/${f.devis}/envoi`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(agent))
      .send({});
    expect(resultat.status).toBe(200);
    const fiche = await admin.query<{ id_utilisateur: string }>(
      'SELECT id_utilisateur::text FROM innov_events.clients WHERE id_client=$1',
      [f.idClient],
    );
    expect(fiche.rows[0]?.id_utilisateur).toBe(utilisateur);
    expect(courriels).toHaveLength(1);
    expect(courriels[0]?.destinataire).toBe('connexion@example.org');
    expect(courriels[0]?.texte).not.toContain('Mot de passe temporaire');
    expect(
      (
        await admin.query('SELECT 1 FROM innov_events.utilisateurs WHERE email_connexion=$1', [
          'ada@example.org',
        ])
      ).rowCount,
    ).toBe(0);
  });
  it('refuse une image d evenement non HTTPS sans creer l evenement', async () => {
    const f = await fixture();
    const { agent } = await connecte('admin@example.org', 'admin');
    const resultat = await agent
      .post('/api/evenements')
      .set(proxy)
      .set('X-CSRF-Token', await csrf(agent))
      .send({
        id_client: f.idClient,
        id_prospect: null,
        id_type_evenement: idType,
        id_theme: null,
        nom: 'Image non securisee',
        date_debut: '2027-02-20T09:00:00Z',
        date_fin: '2027-02-20T17:00:00Z',
        lieu: 'Paris',
        statut_evenement: 'brouillon',
        image_url: 'http://example.org/image.jpg',
        visible_public: false,
      });
    expect(resultat.status).toBe(400);
    expect((await admin.query('SELECT 1 FROM innov_events.evenements')).rowCount).toBe(1);
  });
  it('refuse l envoi d un devis sans prestation sans modifier son etat', async () => {
    const f = await fixture();
    const { agent } = await connecte('admin@example.org', 'admin');
    const resultat = await agent
      .post(`/api/devis/${f.devis}/envoi`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(agent))
      .send({});
    expect(resultat.status).toBe(409);
    const devis = await repository.detail(f.devis);
    expect(devis.statut_devis).toBe('en_preparation');
    expect(devis.date_envoi).toBeNull();
    expect(devis.lignes).toHaveLength(0);
    expect(courriels).toHaveLength(0);
    expect(
      (
        await admin.query('SELECT id_utilisateur FROM innov_events.clients WHERE id_client=$1', [
          f.idClient,
        ])
      ).rows[0]?.id_utilisateur,
    ).toBeNull();
  });
  it('renvoie une contre proposition apres une demande de modification avec motif', async () => {
    const f = await fixture();
    const gestion = await connecte('admin@example.org', 'admin');
    const client = await connecte('ada@example.org', 'client', f.idClient);
    await repository.remplacerLignes(f.devis, [{ libelle_prestation: 'Salle', montant_ht: 100 }]);
    const envoyer = async () =>
      gestion.agent
        .post(`/api/devis/${f.devis}/envoi`)
        .set(proxy)
        .set('X-CSRF-Token', await csrf(gestion.agent))
        .send({});
    expect((await envoyer()).status).toBe(200);
    expect((await repository.detail(f.devis)).statut_devis).toBe('etude_client');

    const motif = 'Ajouter un accueil avec boissons.';
    const demande = await client.agent
      .post(`/api/devis/${f.devis}/reponse`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(client.agent))
      .send({ choix: 'modification', motif_modification: motif });
    expect(demande.status).toBe(200);
    const modification = await repository.detail(f.devis);
    expect(modification.statut_devis).toBe('modification');
    expect(modification.motif_modification).toBe(motif);
    expect(
      (
        await admin.query('SELECT date_modification FROM innov_events.devis WHERE id_devis=$1', [
          f.devis,
        ])
      ).rows[0]?.date_modification,
    ).toBeTruthy();

    const intitule = await gestion.agent
      .patch(`/api/devis/${f.devis}`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(gestion.agent))
      .send({ intitule: 'Formule A avec accueil' });
    expect(intitule.status).toBe(200);
    const prestations = await gestion.agent
      .post(`/api/devis/${f.devis}/lignes`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(gestion.agent))
      .send({
        lignes: [
          { libelle_prestation: 'Salle', montant_ht: 100 },
          { libelle_prestation: 'Accueil avec boissons', montant_ht: 50 },
        ],
      });
    expect(prestations.status).toBe(200);
    expect((await envoyer()).status).toBe(200);

    const consultation = await client.agent.get(`/api/devis/${f.devis}`).set(proxy);
    expect(consultation.status).toBe(200);
    expect(consultation.body).toMatchObject({
      id_devis: f.devis,
      intitule: 'Formule A avec accueil',
      statut_devis: 'etude_client',
      motif_modification: motif,
      totaux: { total_ht: '150.00', total_ttc: '180.00' },
    });
    expect(consultation.body.lignes).toHaveLength(2);
    expect((await repository.detail(f.devis)).statut_devis).toBe('etude_client');
    expect(courriels).toHaveLength(2);
    expect(courriels[1]?.destinataire).toBe('ada@example.org');
    expect(courriels[1]?.piecesJointes?.[0]?.contenu.subarray(0, 4).toString()).toBe('%PDF');
  });
  it.each(['annule', 'termine'])(
    'refuse l acceptation et la modification d un devis envoye si l evenement est %s',
    async (statut) => {
      const f = await fixture();
      const id = await compte(f.idClient, 'ada@example.org');
      await repository.remplacerLignes(f.devis, [
        { libelle_prestation: 'Accueil', montant_ht: 125.5 },
      ]);
      await repository.preparerEnvoi(f.devis, async () => {});
      await admin.query(
        'UPDATE innov_events.evenements SET statut_evenement=$2 WHERE id_evenement=$1',
        [f.evenement, statut],
      );
      for (const choix of ['accepte', 'modification'] as const)
        await expect(
          repository.repondre(f.devis, id, choix, choix === 'modification' ? 'Autre date' : ''),
        ).rejects.toMatchObject({ statut: 409 });
      expect((await repository.detail(f.devis)).statut_devis).toBe('etude_client');
      const evenement = await admin.query<{ statut_evenement: string }>(
        'SELECT statut_evenement FROM innov_events.evenements WHERE id_evenement=$1',
        [f.evenement],
      );
      expect(evenement.rows[0]!.statut_evenement).toBe(statut);
      expect(await repository.repondre(f.devis, id, 'refuse', '')).toBe(false);
      expect((await repository.detail(f.devis)).statut_devis).toBe('refuse');
    },
  );
  it('repond 409 au client qui accepte le devis d un evenement annule', async () => {
    const f = await fixture();
    await repository.remplacerLignes(f.devis, [
      { libelle_prestation: 'Accueil', montant_ht: 125.5 },
    ]);
    await repository.preparerEnvoi(f.devis, async () => {});
    await admin.query(
      "UPDATE innov_events.evenements SET statut_evenement='annule' WHERE id_evenement=$1",
      [f.evenement],
    );
    const { agent } = await connecte('ada@example.org', 'client', f.idClient);
    const reponse = await agent
      .post(`/api/devis/${f.devis}/reponse`)
      .set(proxy)
      .set('X-CSRF-Token', await csrf(agent))
      .send({ choix: 'accepte' });
    expect(reponse.status).toBe(409);
    expect((await repository.detail(f.devis)).statut_devis).toBe('etude_client');
  });
  it('refuse l envoi d un devis si l evenement est annule ou termine', async () => {
    const f = await fixture();
    await repository.remplacerLignes(f.devis, [
      { libelle_prestation: 'Accueil', montant_ht: 125.5 },
    ]);
    for (const statut of ['annule', 'termine']) {
      await admin.query(
        'UPDATE innov_events.evenements SET statut_evenement=$2 WHERE id_evenement=$1',
        [f.evenement, statut],
      );
      const operation = vi.fn(async () => {});
      await expect(repository.preparerEnvoi(f.devis, operation)).rejects.toMatchObject({
        statut: 409,
      });
      expect(operation).not.toHaveBeenCalled();
      const d = await repository.detail(f.devis);
      expect(d.statut_devis).toBe('en_preparation');
      expect(d.date_envoi).toBeNull();
    }
  });
  it('n entre pas en interblocage avec la suppression de la fiche pendant l envoi', async () => {
    const f = await fixture();
    await repository.remplacerLignes(f.devis, [
      { libelle_prestation: 'Accueil', montant_ht: 125.5 },
    ]);
    const { agent } = await connecte('admin@example.org', 'admin');
    const jeton = await csrf(agent);
    const suppression = await admin.connect();
    try {
      await suppression.query('BEGIN');
      // Premier verrou de la suppression administrative : la fiche client.
      await suppression.query('SELECT 1 FROM innov_events.clients WHERE id_client=$1 FOR UPDATE', [
        f.idClient,
      ]);
      const envoi = agent
        .post(`/api/devis/${f.devis}/envoi`)
        .set(proxy)
        .set('X-CSRF-Token', jeton)
        .send({})
        .then((r) => r);
      await vi.waitFor(
        async () => {
          const attente = await admin.query(
            `SELECT 1 FROM pg_stat_activity
            WHERE datname=current_database() AND wait_event_type='Lock'`,
          );
          expect(attente.rowCount).toBeGreaterThan(0);
        },
        { timeout: 5000, interval: 50 },
      );
      // Suite de la suppression : la demande convertie est supprimee, ce qui met
      // evenements.id_prospect a NULL et exige le verrou de l'evenement.
      await suppression.query('SELECT innov_events.supprimer_compte_client($1)', [f.idClient]);
      await suppression.query('COMMIT');
      expect((await envoi).status).toBe(404);
    } catch (erreur) {
      await suppression.query('ROLLBACK').catch(() => undefined);
      throw erreur;
    } finally {
      suppression.release();
    }
    const d = await repository.detail(f.devis);
    expect(d.statut_devis).toBe('en_preparation');
    expect(d.date_envoi).toBeNull();
    expect(courriels).toHaveLength(0);
    const evenement = await admin.query<{ id_prospect: string | null }>(
      'SELECT id_prospect FROM innov_events.evenements WHERE id_evenement=$1',
      [f.evenement],
    );
    expect(evenement.rows[0]!.id_prospect).toBeNull();
  });
  it('une seule acceptation concurrente reussit', async () => {
    const f = await fixture();
    const autre = await repository.creerDevis(f.evenement, 'Formule B');
    const id = await compte(f.idClient, 'ada@example.org');
    await repository.remplacerLignes(f.devis, [
      { libelle_prestation: 'Accueil', montant_ht: 125.5 },
    ]);
    await repository.remplacerLignes(autre, [{ libelle_prestation: 'Salle', montant_ht: 200 }]);
    await repository.preparerEnvoi(f.devis, async () => {});
    await repository.preparerEnvoi(autre, async () => {});
    const resultats = await Promise.allSettled([
      repository.repondre(f.devis, id, 'accepte', ''),
      repository.repondre(autre, id, 'accepte', ''),
    ]);
    expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
