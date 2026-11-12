export interface Configuration {
  port: number;
  production: boolean;
  trustProxyHops: number;
  sessionSecret: string;
  databaseUrl?: string;
  pgHost: string;
  pgPort: number;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
  mongodbUrl: string;
  mongodbDatabase: string;
}

function entierDansPlage(
  valeur: string | undefined,
  repli: number,
  min: number,
  max: number,
): number {
  const resultat = valeur === undefined ? repli : Number(valeur);
  if (!Number.isInteger(resultat) || resultat < min || resultat > max) {
    throw new Error('Variable de configuration numerique invalide');
  }
  return resultat;
}

/** Lit la configuration sans afficher les secrets dans les journaux. */
export function chargerConfiguration(env: NodeJS.ProcessEnv = process.env): Configuration {
  const secret = env.SESSION_SECRET ?? '';
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET doit contenir au moins 32 caracteres');
  }
  if (!env.DATABASE_URL && !env.PGPASSWORD) {
    throw new Error('Configurer DATABASE_URL ou PGPASSWORD');
  }
  return {
    port: entierDansPlage(env.PORT, 3000, 1, 65535),
    production: env.NODE_ENV === 'production',
    trustProxyHops: entierDansPlage(env.TRUST_PROXY_HOPS, 0, 0, 3),
    sessionSecret: secret,
    databaseUrl: env.DATABASE_URL || undefined,
    pgHost: env.PGHOST || 'localhost',
    pgPort: entierDansPlage(env.PGPORT, 5432, 1, 65535),
    pgDatabase: env.PGDATABASE || 'innov_events',
    pgUser: env.PGUSER || 'innov_events_app',
    pgPassword: env.PGPASSWORD || '',
    mongodbUrl: env.MONGODB_URL || 'mongodb://localhost:27017',
    mongodbDatabase: env.MONGODB_DATABASE || 'innov_events_logs',
  };
}
