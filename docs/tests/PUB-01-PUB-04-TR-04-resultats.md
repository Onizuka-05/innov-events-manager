# Résultats — gabarit et pages publiques

**Date :** 14/11/2026  
**Périmètre :** PUB-01 à PUB-04 et page de confidentialité (TR-04).  
**Environnement :** Windows 11, PowerShell, Node.js 24.22.0, Docker Desktop ; dépendances installées par `npm ci` depuis le verrou existant.

## Contrôles automatiques

| Contrôle | Résultat |
|---|---|
| `npm ci` | Réussi (432 paquets) ; 9 alertes « moderate » sur les outils de développement, aucune sur les dépendances de production |
| `npm run format:check` | Réussi |
| `npm run lint` | Réussi, aucune erreur ni avertissement |
| `npm run typecheck` | Réussi |
| `npm run test:coverage` | **24 tests réussis sur 24** ; instructions 97,8 %, branches 93,93 %, fonctions 82,85 %, lignes 100 % |
| `npm run build` | Réussi, budgets respectés ; paquet initial 243,20 kB bruts, 66,40 kB transférés |

La couverture mesurée porte sur les éléments instrumentés par ce lancement Angular (templates compilés inclus) ; elle ne représente pas toute l’application. Le rapport HTML est régénérable dans `coverage/web/index.html`.

## Ce que couvrent les tests

- L’accueil, ses deux illustrations locales avec alternatives et dimensions.
- Le CTA et sa navigation vers la demande de devis encore indisponible ; absence de formulaire ou d’envoi simulé.
- Les six entrées de navigation et l’indication de page courante.
- Ouverture du menu, fermeture par Échap et demande de retour du focus.
- Fermeture du menu après navigation et focus sur le contenu.
- Lien d’évitement depuis une page légale, sans retour à l’accueil.
- Un titre principal unique et le gabarit sur les onze routes, dont une URL inconnue.
- Titres de document, quatre liens légaux et navigation depuis le pied de page.
- Mise à jour du contenu légal quand le composant est réutilisé.
- Présence des prestataires, des durées et des limites de réalisation dans la politique.

jsdom ne reproduit ni les media queries ni le défilement réel : le focus du bouton menu sur petit écran, la remontée en haut de page et la restauration de la position au retour arrière sont vérifiés dans le navigateur.

## Vérifications manuelles

Chrome, fenêtre de navigation privée (extensions désactivées).

| Vérification | Résultat | Date |
|---|---|---|
| Écran 320, 375, 768 et 1440 px ; zoom 200 % | OK | 14/11/2026 |
| Clavier : lien d’évitement (y compris depuis `/cgu`), menu (Entrée, Échap, retour du focus, choix de la page courante) | OK | 14/11/2026 |
| Défilement : CGU → CGV en haut de page, retour arrière à la position précédente | OK | 14/11/2026 |
| Liens du menu et du pied de page, titres, pages d’attente, page introuvable | OK | 14/11/2026 |
| Réseau : aucune ressource hors de l’origine du site (filtre `-domain:127.0.0.1` vide) | OK | 14/11/2026 |
| Build servi par Docker (nginx, port 8080) : rechargement de `/cgu`, console sans erreur sous CSP | OK | 14/11/2026 |
| PR #111 (merge commit `bd29ec5`) et CI sur `dev` | OK, CI verte | 14/11/2026 |

## Lighthouse (mobile, build de production servi par nginx)

| Page | Performance | Accessibilité | Bonnes pratiques | SEO | CLS |
|---|---|---|---|---|---|
| `/` | 95 | 100 | 100 | 58 | 0 |
| `/cgu` | 95 | 100 | 100 | 54 | 0 |

- **Décalage du pied de page corrigé.** La première mesure donnait un CLS de 0,469 sur les deux pages, dû entièrement au pied de page : il s’affichait avant le contenu de la page, chargé à la demande, puis était repoussé vers le bas. Une règle de `styles.css` le masque tant que la zone de contenu est vide ; un navigateur qui ne la reconnaît pas l’affiche normalement.
- **SEO :** score attendu, la balise `noindex, nofollow` interdisant volontairement le référencement d’un site de démonstration.
- Information non bloquante : Chrome signale l’illustration chargée en différé de l’accueil comme « sans dimensions explicites », alors qu’elle porte `width` et `height` ; aucun décalage mesuré.
- Audit axe : non réalisé.

## Limites

- Formulaire de demande de devis (PUB-06), contact, connexion et déconnexion, catalogue et avis : routes d’attente, sans faux envoi.
- Purges, effacement et traitements MongoDB/SQL : la politique les décrit ; leur réalisation et leurs tests relèvent des fonctionnalités correspondantes.
- PUB-01 reste partiel jusqu’au raccordement de la session ; PUB-02 jusqu’à son formulaire ; TR-04 jusqu’aux purges et à l’effacement vérifiés.
