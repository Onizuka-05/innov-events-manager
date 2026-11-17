#!/usr/bin/env node
/**
 * Tableau de tous les tests (TST-04), regroupes par fonctionnalite.
 *
 * Lit les fichiers *.spec.ts de l'API, du web et du mobile, extrait les titres des blocs
 * describe et des tests it / test, puis ecrit docs/tests/tableau-des-tests.md.
 * Sans dependance : Node.js 24 suffit. Usage, depuis la racine du depot :
 *   node outils/tableau-des-tests.mjs            ecrit le tableau
 *   node outils/tableau-des-tests.mjs --verifier code de sortie 1 si le tableau n'est pas a jour
 *
 * Les nombres sont lus dans le code source : un test parametre (it.each) compte autant de cas
 * que d'elements dans son tableau ; un bloc ignore sans base de test est compte quand meme.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SORTIE = join(RACINE, 'docs', 'tests', 'tableau-des-tests.md');
const DOSSIERS = [
  'services/api/src',
  'apps/web/src',
  'apps/web/e2e',
  'apps/mobile/src',
  'apps/mobile/e2e',
];

/** Fonctionnalites, dans l'ordre d'affichage. */
const GROUPES = [
  'Socle technique',
  'Sécurité et contrôle des accès',
  'Authentification et comptes',
  'Site public, demande de devis et contact',
  'Devis et événements',
  'Espace de l’équipe et administration',
  'Espace client',
  'Journaux et purges des données',
  'Application mobile',
  'Autres',
];

/**
 * Correspondance fichier → fonctionnalite. La premiere regle dont le motif correspond au
 * chemin s'applique ; ses regles « titres » (titre complet, blocs compris) sont prioritaires.
 */
const REGLES = [
  { motif: /^apps\/mobile\//u, groupe: 'Application mobile' },
  {
    motif: /routes\/j7\.integration\.spec\.ts$/u,
    groupe: 'Authentification et comptes',
    titres: [
      [/\b(devis|contact) :/u, 'Site public, demande de devis et contact'],
      [/\bjournaux\b/u, 'Journaux et purges des données'],
      [
        /CSRF|CF-Connecting-IP|limitation|\bbloque\b|session restreinte/u,
        'Sécurité et contrôle des accès',
      ],
    ],
  },
  { motif: /routes\/j8\.integration\.spec\.ts$/u, groupe: 'Devis et événements' },
  { motif: /routes\/j9\.integration\.spec\.ts$/u, groupe: 'Espace de l’équipe et administration' },
  {
    motif: /routes\/j10\.integration\.spec\.ts$/u,
    groupe: 'Autres',
    titres: [
      [/matrice d.acces/u, 'Sécurité et contrôle des accès'],
      [/espace client|effacement/u, 'Espace client'],
      [/catalogue public/u, 'Site public, demande de devis et contact'],
      [/purges/u, 'Journaux et purges des données'],
      [/evenements a venir du mobile/u, 'Application mobile'],
    ],
  },
  {
    motif: /(middlewares\/|csrf\.routes|nginx\.integration)/u,
    groupe: 'Sécurité et contrôle des accès',
  },
  {
    motif: /(config\/|sante\.routes|courriels\.service|core\/api\.service)/u,
    groupe: 'Socle technique',
  },
  { motif: /(logs\.repository|purges\.service)/u, groupe: 'Journaux et purges des données' },
  { motif: /(devis\.service|pages\/devis\/|core\/statuts)/u, groupe: 'Devis et événements' },
  { motif: /(gestion\.service|pages\/gestion\/)/u, groupe: 'Espace de l’équipe et administration' },
  { motif: /(authentification)/u, groupe: 'Authentification et comptes' },
  {
    motif: /(espace-client|pages\/espace|pages\/client|profil|mes-evenements)/u,
    groupe: 'Espace client',
  },
  {
    motif: /pages\/catalogue\//u,
    groupe: 'Site public, demande de devis et contact',
    titres: [[/presente les chiffres en valeur/u, 'Espace de l’équipe et administration']],
  },
  {
    motif:
      /(app\.spec|formulaires|demande-devis|evenements-publics|pages\/evenements|pages\/avis|page-legale|accueil)/u,
    groupe: 'Site public, demande de devis et contact',
  },
];

/** Niveau de test deduit de l'emplacement du fichier. */
function niveau(chemin) {
  if (/\/e2e\//u.test(chemin)) return 'Bout en bout';
  if (/\.integration\.spec\.ts$/u.test(chemin)) return 'Intégration';
  return 'Unitaire';
}

function fichiersSpec(dossier) {
  const absolu = join(RACINE, dossier);
  if (!existsSync(absolu)) return [];
  return readdirSync(absolu, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.spec.ts'))
    .map((e) => relative(RACINE, join(e.parentPath, e.name)).split(sep).join('/'))
    .filter((c) => !c.includes('/node_modules/'));
}

/** Remplace commentaires et contenu des chaines par des espaces (positions conservees). */
function masquer(source) {
  const sortie = source.split('');
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const suivant = source[i + 1];
    if (c === '/' && suivant === '/') {
      while (i < source.length && source[i] !== '\n') sortie[i++] = ' ';
    } else if (c === '/' && suivant === '*') {
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) sortie[i++] = ' ';
      sortie[i++] = ' ';
      sortie[i++] = ' ';
    } else if (c === '/' && /[(,=:[!&|?{};]|^$/u.test(precedent(source, i))) {
      // Expression reguliere litterale : son contenu peut contenir des guillemets.
      let classe = false;
      i++;
      while (i < source.length && source[i] !== '\n' && (classe || source[i] !== '/')) {
        if (source[i] === '\\') sortie[i++] = ' ';
        else if (source[i] === '[') classe = true;
        else if (source[i] === ']') classe = false;
        sortie[i++] = ' ';
      }
      i++;
    } else if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < source.length && source[i] !== c) {
        if (source[i] === '\\') sortie[i++] = ' ';
        if (source[i] !== '\n') sortie[i] = ' ';
        i++;
      }
      i++;
    } else i++;
  }
  return sortie.join('');
}

/** Dernier caractere non blanc avant la position donnee ('' en debut de fichier). */
function precedent(source, position) {
  for (let i = position - 1; i >= 0; i--) if (!/\s/u.test(source[i])) return source[i];
  return '';
}

/** Position de la parenthese fermante correspondant a celle ouverte en `debut`. */
function fermante(masque, debut) {
  let profondeur = 0;
  for (let i = debut; i < masque.length; i++) {
    if ('([{'.includes(masque[i])) profondeur++;
    else if (')]}'.includes(masque[i]) && --profondeur === 0) return i;
  }
  return masque.length - 1;
}

/** Nombre d'elements d'un tableau litteral commencant en `debut` (sinon 1). */
function elements(masque, debut) {
  if (masque[debut] !== '[') return 1;
  const fin = fermante(masque, debut);
  const interieur = masque.slice(debut + 1, fin);
  if (!interieur.trim()) return 0;
  let profondeur = 0;
  let nombre = 1;
  for (const c of interieur) {
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    else if (c === ',' && profondeur === 0) nombre++;
  }
  // Virgule finale : pas d'element supplementaire.
  return interieur.trimEnd().endsWith(',') ? nombre - 1 : nombre;
}

/**
 * Pour it.each(nom), position du tableau litteral affecte a cette constante dans le fichier
 * (const nom = [...]) ; null si l'argument n'est pas un nom ou si le tableau est introuvable.
 */
function tableauNomme(masque, debut) {
  const nom = /^[A-Za-z_$][\w$]*/u.exec(masque.slice(debut));
  if (!nom) return null;
  const declaration = new RegExp(`\\b(?:const|let)\\s+${nom[0]}\\b[^=]*=\\s*\\[`, 'u').exec(masque);
  return declaration ? declaration.index + declaration[0].length - 1 : null;
}

/** Extrait les blocs et les tests d'un fichier, avec leur imbrication. */
function analyser(source) {
  const masque = masquer(source);
  const appels = [];
  const motif = /(?<![.\w$])(describe|it|test)\b/gu;
  for (const trouve of masque.matchAll(motif)) {
    let i = trouve.index + trouve[0].length;
    let type = trouve[1] === 'describe' ? 'bloc' : 'test';
    let cas = 1;
    for (;;) {
      const chaine =
        /^\s*\.\s*(only|skip|todo|concurrent|describe|each|skipIf|runIf|fails)\b/u.exec(
          masque.slice(i),
        );
      if (!chaine) break;
      i += chaine[0].length;
      if (chaine[1] === 'describe') type = 'bloc';
      if (/^\s*\(/u.test(masque.slice(i))) {
        const ouverture = masque.indexOf('(', i);
        if (chaine[1] === 'each') {
          const argument = masque.slice(ouverture + 1).search(/\S/u) + ouverture + 1;
          cas = elements(masque, tableauNomme(masque, argument) ?? argument);
        }
        i = fermante(masque, ouverture) + 1;
      }
    }
    const appel = /^\s*\(\s*(['"`])/u.exec(masque.slice(i));
    if (!appel) continue;
    const ouverture = masque.indexOf('(', i);
    const debutTitre = i + appel[0].length;
    const finTitre = source.indexOf(appel[1], debutTitre);
    const titre = source.slice(debutTitre, finTitre).replace(/\\(.)/gu, '$1');
    appels.push({ type, titre, cas, debut: ouverture, fin: fermante(masque, ouverture) });
  }
  const blocs = appels.filter((a) => a.type === 'bloc');
  return appels
    .filter((a) => a.type === 'test')
    .map((t) => ({
      chemin: blocs.filter((b) => b.debut < t.debut && t.fin <= b.fin).map((b) => b.titre),
      titre: t.titre,
      cas: t.cas,
    }));
}

function groupeDe(fichier, titreComplet) {
  const regle = REGLES.find((r) => r.motif.test(fichier));
  if (!regle) return 'Autres';
  const parTitre = (regle.titres ?? []).find(([motif]) => motif.test(titreComplet));
  return parTitre ? parTitre[1] : regle.groupe;
}

function echapper(texte) {
  return texte.replace(/\|/gu, '\\|').replace(/\s+/gu, ' ').trim();
}

function produire() {
  const lignes = [];
  for (const fichier of DOSSIERS.flatMap(fichiersSpec).sort()) {
    for (const t of analyser(readFileSync(join(RACINE, fichier), 'utf8'))) {
      const titreComplet = [...t.chemin, t.titre].join(' › ');
      // Les regles par titre ignorent le bloc de premier niveau, qui decrit tout le fichier.
      const titreInterne = [...t.chemin.slice(1), t.titre].join(' › ');
      lignes.push({
        fichier,
        titreComplet,
        niveau: niveau(fichier),
        cas: t.cas,
        groupe: groupeDe(fichier, titreInterne),
      });
    }
  }
  const niveaux = ['Unitaire', 'Intégration', 'Bout en bout'];
  const somme = (liste) => liste.reduce((n, l) => n + l.cas, 0);
  const md = [
    '# Tableau des tests, regroupés par fonctionnalité (TST-04)',
    '',
    'Généré par `node outils/tableau-des-tests.mjs` depuis la racine du dépôt, à partir des fichiers `*.spec.ts` de l’API (`services/api`), du site web (`apps/web`) et de l’application mobile (`apps/mobile`). Ne pas modifier à la main : relancer le script après chaque ajout de test.',
    '',
    'Niveaux : **unitaire** (fonction, service ou composant isolé, dépendances simulées) ; **intégration** (API Express complète avec Supertest sur une base PostgreSQL réelle et jetable, ou nginx réel) ; **bout en bout** (navigateur Playwright ; pile Docker Compose réelle pour le web, API simulée pour le mobile). Un test paramétré compte autant de cas que d’entrées dans son tableau. Les tests d’intégration de l’API et de nginx sont ignorés sans base de test ou sans nginx : le nombre exécuté peut donc être inférieur sur un poste qui n’a pas ces services.',
    '',
    '## Synthèse',
    '',
    '| Fonctionnalité | Unitaire | Intégration | Bout en bout | Total |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  const presents = GROUPES.filter((g) => lignes.some((l) => l.groupe === g));
  for (const g of presents) {
    const duGroupe = lignes.filter((l) => l.groupe === g);
    md.push(
      `| [${g}](#${ancre(g)}) | ${niveaux.map((n) => somme(duGroupe.filter((l) => l.niveau === n))).join(' | ')} | ${somme(duGroupe)} |`,
    );
  }
  md.push(
    `| **Total** | ${niveaux.map((n) => `**${somme(lignes.filter((l) => l.niveau === n))}**`).join(' | ')} | **${somme(lignes)}** |`,
    '',
  );
  for (const g of presents) {
    const duGroupe = lignes.filter((l) => l.groupe === g);
    md.push(
      `## ${g}`,
      '',
      `${somme(duGroupe)} tests.`,
      '',
      '| Fichier | Test | Niveau | Cas |',
      '| --- | --- | --- | ---: |',
    );
    for (const l of duGroupe)
      md.push(`| \`${l.fichier}\` | ${echapper(l.titreComplet)} | ${l.niveau} | ${l.cas} |`);
    md.push('');
  }
  return md.join('\n');
}

/** Ancre de titre au format GitHub (minuscules, espaces en tirets, ponctuation retiree). */
function ancre(titre) {
  return titre
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /gu, '-');
}

const contenu = produire();
if (process.argv.includes('--verifier')) {
  const actuel = existsSync(SORTIE) ? readFileSync(SORTIE, 'utf8') : '';
  if (actuel !== contenu) {
    console.error(
      'docs/tests/tableau-des-tests.md n’est pas à jour : lancer node outils/tableau-des-tests.mjs',
    );
    process.exit(1);
  }
  console.log('docs/tests/tableau-des-tests.md est à jour.');
} else {
  writeFileSync(SORTIE, contenu, 'utf8');
  console.log(`docs/tests/tableau-des-tests.md écrit.`);
}
