import csrf from '@dr.pogodin/csurf';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import type { MongoClient } from 'mongodb';
import type { Pool } from 'pg';
import type { Configuration } from './config/config.js';
import { CsrfController } from './controllers/csrf.controller.js';
import { SanteController } from './controllers/sante.controller.js';
import { verifierAccesProxy } from './middlewares/acces-proxy.middleware.js';
import { gererErreurs, routeAbsente } from './middlewares/erreurs.middleware.js';
import { SanteRepository } from './repositories/sante.repository.js';
import { creerRoutesCsrf } from './routes/csrf.routes.js';
import { creerRoutesSante } from './routes/sante.routes.js';
import { SanteService } from './services/sante.service.js';
import { lireIpClient, limiterDebit } from './middlewares/ip-client.middleware.js';
import { restreindreSession } from './middlewares/authentification.middleware.js';
import { UtilisateursRepository } from './repositories/utilisateurs.repository.js';
import { LogsRepository } from './repositories/logs.repository.js';
import { FormulairesRepository } from './repositories/formulaires.repository.js';
import { AuthentificationService } from './services/authentification.service.js';
import { CourrielsService, type EnvoiCourriels } from './services/courriels.service.js';
import { MotsDePasseService } from './services/mots-de-passe.service.js';
import { LogsService } from './services/logs.service.js';
import { FormulairesService } from './services/formulaires.service.js';
import { AuthentificationController } from './controllers/authentification.controller.js';
import { FormulairesController } from './controllers/formulaires.controller.js';
import { creerRoutesAuthentification } from './routes/authentification.routes.js';
import { creerRoutesFormulaires } from './routes/formulaires.routes.js';

export interface Dependances {
  postgres: Pool;
  mongodb: MongoClient;
  configuration: Configuration;
  /** Stockage des sessions ; PostgreSQL par defaut, remplacable dans les tests. */
  stockageSession?: session.Store;
  courriels?: EnvoiCourriels;
}

/** Cree le stockage des sessions dans la table innov_events.sessions creee par le script SQL. */
function creerStockagePostgresql(postgres: Pool): session.Store {
  const StockageSession = connectPgSimple(session);
  return new StockageSession({
    pool: postgres,
    tableName: 'sessions',
    schemaName: 'innov_events',
    createTableIfMissing: false,
  });
}

/** Assemble les middlewares et les couches de l'application. */
export function creerApp({
  postgres,
  mongodb,
  configuration,
  stockageSession,
  courriels,
}: Dependances) {
  const app = express();
  app.disable('x-powered-by');
  // IP du client : aucune confiance par defaut ; Compose regle 1 (nginx local).
  app.set('trust proxy', configuration.trustProxyHops);
  app.use(helmet());
  // Refuse tout appel qui ne passe pas par l'un des deux nginx (en-tête secret),
  // sauf GET /api/sante, appelée par les sondes de l'hébergeur.
  app.use(verifierAccesProxy(configuration.secretProxyInterne));
  // Route de santé avant la limitation de débit, la session et le CSRF :
  // les sondes de l'hébergeur ne créent pas de session et ne consomment pas le quota.
  const repository = new SanteRepository(postgres, mongodb, configuration.mongodbDatabase);
  const controller = new SanteController(new SanteService(repository));
  app.use('/api/sante', creerRoutesSante(controller));
  app.use(express.json({ limit: '32kb' }));
  app.use(lireIpClient);
  app.use(limiterDebit(120));
  app.use((_requete, reponse, suivant) => {
    reponse.setHeader('Cache-Control', 'no-store');
    suivant();
  });

  app.use(
    session({
      name: 'innov.sid',
      store: stockageSession ?? creerStockagePostgresql(postgres),
      secret: configuration.sessionSecret,
      resave: false,
      saveUninitialized: false,
      // En production, le HTTPS est termine par l'hebergeur : X-Forwarded-Proto indique
      // si la requete d'origine etait chiffree, ce qui permet d'emettre le cookie Secure.
      // Ce reglage ne sert pas a determiner l'IP du client.
      proxy: configuration.production,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: configuration.production,
        maxAge: 8 * 60 * 60_000,
      },
    }),
  );

  // Le secret CSRF est conserve dans la session. Les appels modifiant des donnees
  // transmettent le jeton dans l'en-tete X-CSRF-Token.
  const envoi = courriels ?? new CourrielsService(configuration);
  const auth = new AuthentificationService(
    new UtilisateursRepository(postgres),
    new MotsDePasseService(),
    envoi,
    new LogsService(new LogsRepository(mongodb, configuration.mongodbDatabase)),
  );
  const formulaires = new FormulairesRepository(postgres);
  app.use(restreindreSession(auth));
  app.use(csrf());
  app.use('/api/csrf', creerRoutesCsrf(new CsrfController()));
  app.use('/api', creerRoutesAuthentification(new AuthentificationController(auth), auth));
  app.use(
    '/api',
    creerRoutesFormulaires(
      new FormulairesController(
        new FormulairesService(
          formulaires,
          envoi,
          configuration.mailContact ?? 'contact@innov-events.invalid',
        ),
        formulaires,
      ),
      auth,
    ),
  );
  app.use(routeAbsente);
  app.use(gererErreurs);
  return app;
}
