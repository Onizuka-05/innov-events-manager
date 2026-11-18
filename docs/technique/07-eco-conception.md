# 7. Éco-conception

Objectif : transférer, calculer et stocker le moins possible pour rendre le même service, sans dégrader l'accessibilité. Les besoins ont été posés dès l'architecture ([`docs/conception/CO-06-couches-securite.md`](../conception/CO-06-couches-securite.md), section « Éco-conception ») ; ce chapitre indique ce qui est appliqué, ce qui a été mesuré et ce qui reste à faire.

## 7.1 Mesures appliquées

| Domaine | Mesure | Où |
|---|---|---|
| Architecture | Une seule API pour le site et le mobile : aucun traitement dupliqué | `services/api` |
| Architecture | Application mobile web, ouverte dans le navigateur du téléphone, sans build natif ni magasin d'applications | `apps/mobile` |
| Architecture | Services gratuits mis en veille sans trafic (Render, calcul Neon) : aucune ressource consommée la nuit sans visiteur | Hébergement |
| Architecture | Notes partagées sans connexion permanente (pas de WebSocket) : elles s'affichent au chargement suivant | API, web, mobile |
| JavaScript | Routes chargées à la demande : 29 routes du site ne téléchargent leur page que lorsqu'on les ouvre | `apps/web/src/app/app.routes.ts` |
| JavaScript | Budgets de build : avertissement au-delà de 500 ko pour le code initial, erreur au-delà de 1 Mo ; 4 ko par feuille de style de composant | `apps/web/angular.json` |
| JavaScript | Aucune bibliothèque d'interface ni de CSS ajoutée au site web (Angular seul) | `apps/web/package.json` |
| Images | Illustrations en SVG (quelques kilo-octets, nettes à toutes les tailles) ; image hors du premier écran chargée en différé (`loading="lazy"`) | `apps/web/public/images/` |
| Images | Images des événements : simple adresse `https`, aucune image stockée ni redimensionnée par le serveur | API, page Événements |
| Police | Police système : aucun fichier de police téléchargé | `apps/web/src/styles.css` |
| Données | Page publique des événements paginée par 12, filtres appliqués par la base | `evenements-publics.repository.ts` |
| Données | Colonnes choisies explicitement dans chaque requête SQL (pas de `SELECT *`) ; réponses JSON limitées aux champs affichés | Repositories |
| Données | PDF des devis générés à la demande, jamais stockés | `devis-pdf.service.ts` |
| Données | Purges : journaux supprimés après 6 mois ou 1 an, demandes classées sans suite après 3 ans | `purges.service.ts`, index TTL |
| Réseau | API en `Cache-Control: no-store` (données personnelles) ; fichiers statiques nommés avec une empreinte (`outputHashing`), donc réutilisables par le navigateur d'un déploiement à l'autre quand ils ne changent pas | API, builds Angular |

## 7.2 Mesures relevées

Audit Lighthouse (navigation, ordinateur) des contrôles du site web du 17/11/2026 (`docs/tests/J10-web-resultats.md`, A6) :

| Page | Performance | Accessibilité | Bonnes pratiques |
|---|---|---|---|
| `/evenements` | 83 | 100 | 96 |
| `/espace` | 73 | 100 | 100 |

Le décalage de mise en page relevé sur `/espace` (CLS de 0,317) vient de l'affichage des blocs après le chargement des données ; il pèse sur le score de performance.

## 7.3 Limites et pistes

- La compression gzip ou Brotli n'est pas activée dans les deux configurations nginx : l'activer pour le JavaScript, le CSS et le JSON réduirait fortement les transferts.
- Les listes de l'espace de l'équipe ne sont pas paginées : suffisant au volume d'une agence, à revoir si les données grossissent.
- Réserver la place des blocs de `/espace` avant l'arrivée des données supprimerait le décalage de mise en page.
- Les en-têtes de cache longs des fichiers statiques à empreinte ne sont pas configurés explicitement dans nginx.
- Aucune mesure énergétique n'a été faite : les effets sont estimés par les volumes transférés et les scores Lighthouse, pas en énergie consommée.
