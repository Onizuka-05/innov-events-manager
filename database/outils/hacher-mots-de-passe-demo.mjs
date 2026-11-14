// Genere les variables psql attendues par CO-05-jeu-essai.sql (jeu d'essai local uniquement).
// Le mot de passe de test est lu dans MDP_DEMO ; il n'est jamais ecrit dans le depot.
// Chaque compte recoit son propre hachage Argon2id (sel aleatoire distinct).
// Procedure complete : docs/tests/CO-05-resultats.md.
import argon2 from 'argon2';

const REGLE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const VARIABLES = [
  'hash_admin',
  'hash_employe',
  'hash_ancien_employe',
  'hash_client',
  'hash_suspendu',
  'hash_effacer',
  'hash_temporaire',
];

const motDePasse = process.env.MDP_DEMO ?? '';
if (!REGLE.test(motDePasse)) {
  console.error(
    'MDP_DEMO : 8 caracteres minimum, avec majuscule, minuscule, chiffre et caractere special.',
  );
  process.exit(1);
}

for (const nom of VARIABLES) {
  const hachage = await argon2.hash(motDePasse, { type: argon2.argon2id });
  console.log(`\\set ${nom} '${hachage}'`);
}
