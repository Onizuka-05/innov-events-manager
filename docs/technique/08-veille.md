# 8. Veille technologique et sécurité

## 8.1 Sources

| Domaine | Sources | Ce qui est surveillé |
|---|---|---|
| Vulnérabilités | CERT-FR (ANSSI) : avis et alertes ; base GitHub Advisory, utilisée par `npm audit` ; avis de sécurité de Node.js | Failles touchant Node.js, les paquets npm du projet, nginx, PostgreSQL |
| Bonnes pratiques de sécurité | OWASP Top 10, OWASP ASVS, aide-mémoire OWASP (sessions, CSRF, mots de passe) ; guides de l'ANSSI | Contrôles à appliquer à l'authentification, aux sessions et aux échanges |
| Données personnelles | CNIL : information des personnes, durées de conservation, sécurité | Politique de confidentialité, purges, minimisation |
| Technologies du projet | Notes de version et blogs officiels : Node.js, Angular, Ionic, Express, PostgreSQL, MongoDB, nginx ; calendrier des versions LTS de Node.js | Fin de support, changements incompatibles, correctifs |
| Hébergement et DevOps | Documentation, notes de version et pages d'état de Render, Neon, MongoDB Atlas, Brevo et GitHub Actions ; e-mails des fournisseurs | Évolution des offres gratuites, quotas, régions, incidents, versions imposées |

## 8.2 Méthode

1. **À chaque exécution de la CI** : audit des dépendances de production (`npm audit --omit=dev --audit-level=high`). Une vulnérabilité élevée ou critique bloque la fusion et le déploiement.
2. **Avant d'ajouter une dépendance** : maintenance active (dernière publication, dépôt non archivé), licence compatible avec une exploitation commerciale, nombre de dépendances apportées, alternative déjà présente dans le projet. Les dépendances ajoutées après le socle (`argon2`, `nodemailer`, `pdfkit`, `@playwright/test`) ont suivi ce contrôle.
3. **Avant de choisir une version** : version LTS ou stable, identique partout où le composant s'exécute (Node.js 24 et PostgreSQL 16.15 sur le poste, en CI et en production ; MongoDB 8.0 sur le poste et en production).
4. **Chaque mois et à chaque alerte** : mise à jour des dépendances selon la procédure du plan de tests (§6), jamais par `npm audit fix --force` ; images Docker vérifiées contre leurs notes de version.
5. **À chaque annonce d'un fournisseur** : lecture de l'impact (quota, version, région), puis tests d'acceptation rejoués si l'environnement de production change.
6. **Traçabilité** : chaque constat qui change le projet donne lieu à une issue ou à une PR, et à une ligne du [journal des incidents](09-journal-des-incidents.md) s'il a causé une panne.

## 8.3 Décisions issues de la veille

| Constat | Source | Décision |
|---|---|---|
| Le paquet `csurf`, longtemps standard pour Express, est archivé et n'est plus maintenu | Dépôt npm et GitHub du paquet | Remplacé par `@dr.pogodin/csurf`, version maintenue au même fonctionnement, jeton stocké dans la session PostgreSQL |
| MongoDB Atlas impose la version 8.0 sur l'offre gratuite et la met à jour lui-même | Console et documentation Atlas | Image locale alignée sur `mongo:8.0` ; pilote `mongodb` 6.22 compatible |
| Render ne fournit pas de réseau privé sur l'offre gratuite : l'API est joignable directement | Documentation Render | Accès à l'API réservé aux deux nginx par un en-tête secret ; adresse IP lue dans un en-tête de confiance écrasé par nginx |
| La documentation d'Express indique que `trust proxy` et `X-Forwarded-For` peuvent être falsifiés selon la chaîne de proxys | Documentation Express, aide-mémoire OWASP | L'API ignore `X-Forwarded-For` et `CF-Connecting-IP` venant du client ; tests de falsification avec un nginx réel |
| Recommandations OWASP sur le stockage des mots de passe | Aide-mémoire OWASP « Password Storage » | Argon2id, paramètres mémoire et passes conformes ; mot de passe temporaire stocké à part et à usage unique |
| Les sauvegardes Atlas ne sont pas disponibles sur l'offre gratuite, et l'historique de Neon est court (6 heures) | Consoles Atlas et Neon | Scripts de sauvegarde en lecture seule et restauration de contrôle locale |
| Neon ajoute des options de colonnes internes, refusées par PostgreSQL standard, dans ses exports | Essai de restauration du 17/11/2026 | Script de restauration adapté (voir le journal des incidents) |
| La version de nginx proposée au départ n'était plus maintenue | Notes de version de nginx | Images `nginx:1.30-alpine` |
| Lighthouse ne vérifie qu'une partie des règles d'accessibilité d'axe-core | Documentation Lighthouse | Audit axe à mener en plus du score Lighthouse pour la recette d'accessibilité |

## 8.4 Pour une exploitation réelle

- Activer les alertes de sécurité et Dependabot de GitHub (non activés pendant le projet, la mise à jour restant manuelle et testée).
- S'abonner aux flux du CERT-FR et aux avis de sécurité de Node.js et d'Angular.
- Remplacer l'envoi d'un mot de passe temporaire par un lien de réinitialisation à usage unique, et vérifier les adresses e-mail à l'inscription.
