import { Pool } from 'pg';
import { email, motDePasse, texte } from '../http/validation.js';
import { UtilisateursRepository } from '../repositories/utilisateurs.repository.js';
import { MotsDePasseService } from '../services/mots-de-passe.service.js';

/** Script hors HTTP ; ne modifie jamais un compte deja present. */
async function creerAdmin(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.PGPASSWORD)
    throw new Error('Configurer la connexion PostgreSQL.');
  const donnees = {
    email_connexion: email(texte(process.env, 'ADMIN_EMAIL', 255)),
    nom_utilisateur: texte(process.env, 'ADMIN_IDENTIFIANT', 100),
    prenom: texte(process.env, 'ADMIN_PRENOM', 120),
    nom: texte(process.env, 'ADMIN_NOM', 120),
  };
  const mot = motDePasse(process.env.ADMIN_MOT_DE_PASSE);
  delete process.env.ADMIN_MOT_DE_PASSE;
  const postgres = new Pool(
    process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : undefined,
  );
  try {
    await new UtilisateursRepository(postgres).creerAdmin(
      donnees,
      await new MotsDePasseService().hacher(mot),
    );
  } finally {
    await postgres.end();
  }
  console.info('Compte administrateur créé.');
}

creerAdmin().catch(() => {
  console.error(
    'Création refusée. Vérifiez la saisie, la connexion et l’absence d’un administrateur existant.',
  );
  process.exitCode = 1;
});
