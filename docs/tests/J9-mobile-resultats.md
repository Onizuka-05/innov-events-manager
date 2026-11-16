# J9 — Authentification et événements mobiles

Date : 16/11/2026. Fichiers établis à partir de `3c7b6d9effc14ce06eb0d823eb5bb5e795612c3c`.

Cette PR utilise les routes API ajoutées par la PR #119 (administration et espace employé). Elle ne modifie que les fichiers mobiles et ce rapport.

## Comportement

- À l'ouverture, `/home` recharge la session et exige un rôle employé ou administrateur. Un visiteur est dirigé vers la connexion ; un compte client ne peut accéder à cet espace.
- L'authentification utilise les cookies de même origine et un nouveau jeton CSRF pour chaque modification. Aucun jeton ni mot de passe n'est conservé dans le stockage du navigateur.
- Un mot de passe temporaire conduit au renouvellement obligatoire ; l'oubli et l'abandon du renouvellement sont disponibles.
- Les événements à venir sont obtenus par `GET /api/evenements?avenir=true`, triés par date de début côté PostgreSQL. Les événements annulés et terminés, ainsi que ceux dont le début est passé, sont exclus. La liste indique le nom, le client, les dates, le lieu et le statut.
- La liste est rechargée à chaque entrée Ionic et par le bouton Actualiser. La déconnexion détruit la session serveur et vide la liste. En cas d'erreur au rechargement, la liste précédente est effacée.
- Palette claire commune au web, couleurs primaire et danger explicites, focus visible et formulaires étiquetés.

## Vérifications

Poste : Windows 11, PowerShell 5.1. Code : `dev` à `94fd8e4` complété par cette PR. Date : 16/11/2026.

| Contrôle | Commande depuis `apps/mobile` | Résultat |
|---|---|---|
| Installation | `npm.cmd ci` | OK |
| Format | `npm.cmd run format:check` | OK |
| Lint | `npm.cmd run lint` | OK |
| Types | `npm.cmd run typecheck` | OK |
| Tests et couverture | `npm.cmd run test:coverage` | 23 réussis sur 23 (5 fichiers), 0 ignoré ; couverture des lignes 69,59 % |
| Build | `npm.cmd run build` | OK (`www/`) |
| Audit production | `npm.cmd audit --omit=dev --audit-level=high` | 0 vulnérabilité |
| Parcours Playwright (Chromium, format téléphone) | `npm.cmd run test:e2e` | 1 réussi : liste protégée, connexion de l'employé, affichage, rechargement, déconnexion |

Le scénario Playwright et les tests unitaires utilisent des réponses API simulées, avec des dates au format ISO.

## Parcours manuels

À réaliser sur l'application complète, avant la mise en production : connexion de l'employé et de l'administrateur avec l'API réelle sous Docker Compose, refus du compte client, renouvellement du mot de passe temporaire et oubli, perte de session, puis affichage de la liste sur iPhone, clavier et focus.
