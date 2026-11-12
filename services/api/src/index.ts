import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { creerApp } from './app.js';
import { chargerConfiguration } from './config/config.js';

async function demarrer(): Promise<void> {
  const configuration = chargerConfiguration();
  const postgres = new Pool(
    configuration.databaseUrl
      ? { connectionString: configuration.databaseUrl, max: 10 }
      : {
          host: configuration.pgHost,
          port: configuration.pgPort,
          database: configuration.pgDatabase,
          user: configuration.pgUser,
          password: configuration.pgPassword,
          max: 10,
        },
  );
  const mongodb = new MongoClient(configuration.mongodbUrl, { serverSelectionTimeoutMS: 3_000 });
  const app = creerApp({ postgres, mongodb, configuration });
  const serveur = app.listen(configuration.port, '0.0.0.0', () => {
    console.info(`API disponible sur le port ${configuration.port}`);
  });
  async function arreter(): Promise<void> {
    serveur.close();
    await Promise.allSettled([postgres.end(), mongodb.close()]);
  }
  process.once('SIGINT', () => {
    void arreter().then(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void arreter().then(() => process.exit(0));
  });
}

// Les messages de configuration ne contiennent aucun secret : les afficher accelere le diagnostic.
demarrer().catch((erreur: unknown) => {
  const cause = erreur instanceof Error ? erreur.message : 'cause inconnue';
  console.error(`Demarrage impossible : ${cause}`);
  process.exitCode = 1;
});
