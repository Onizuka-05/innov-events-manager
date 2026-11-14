export interface Configuration {
  port: number;
  production: boolean;
  trustProxyHops: number;
  sessionSecret: string;
  secretProxyInterne: string;
  databaseUrl?: string;
  pgHost: string;
  pgPort: number;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
  mongodbUrl: string;
  mongodbDatabase: string;
  mailExpediteur?: string;
  mailContact?: string;
  brevoApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
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
  const secretProxyInterne = env.INTERNAL_PROXY_SECRET ?? '';
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(secretProxyInterne)) {
    throw new Error('INTERNAL_PROXY_SECRET invalide : 32 a 128 caracteres base64url');
  }
  if (!env.DATABASE_URL && !env.PGPASSWORD) {
    throw new Error('Configurer DATABASE_URL ou PGPASSWORD');
  }
  const production = env.NODE_ENV === 'production';
  // En production, aucun repli sur une base locale : l'API refuse de démarrer.
  if (production && !env.MONGODB_URL) {
    throw new Error('MONGODB_URL obligatoire en production');
  }
  if (production && (!env.BREVO_API_KEY || !env.MAIL_EXPEDITEUR || !env.MAIL_CONTACT)) {
    throw new Error('Configurer BREVO_API_KEY, MAIL_EXPEDITEUR et MAIL_CONTACT en production');
  }
  for (const adresse of [env.MAIL_EXPEDITEUR, env.MAIL_CONTACT]) {
    if (adresse && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(adresse))
      throw new Error('Adresse de courriel de configuration invalide');
  }
  return {
    mailExpediteur: env.MAIL_EXPEDITEUR || 'ne-pas-repondre@innov-events.invalid',
    mailContact: env.MAIL_CONTACT || 'contact@innov-events.invalid',
    brevoApiKey: env.BREVO_API_KEY,
    smtpHost: env.SMTP_HOST || 'localhost',
    smtpPort: entierDansPlage(env.SMTP_PORT, 1025, 1, 65535),
    port: entierDansPlage(env.PORT, 3000, 1, 65535),
    production,
    trustProxyHops: entierDansPlage(env.TRUST_PROXY_HOPS, 0, 0, 3),
    sessionSecret: secret,
    secretProxyInterne,
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
