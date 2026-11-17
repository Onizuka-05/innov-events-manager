# Vérifications du web : espace client, catalogue et tableau de bord

Date : 17 novembre 2026.

Contrôles exécutés le 17/11/2026 sur Windows 11, PowerShell 5.1, Node.js 24.22.0, et parcours sur la pile Docker Compose locale avec des données fictives. Les routes de l’espace client et du catalogue nécessitent l’API correspondante. Aucun changement de schéma ni de dépendance n’est requis.

## Fonctionnalités

| Exigence | Comportement à vérifier |
| --- | --- |
| CLI-02, CLI-05 | Accueil client : trois prochains événements au plus ; suivi en étapes des demandes rattachées à la fiche et des seuls devis envoyés ; cas vide avec lien de demande de devis. |
| CLI-01 | Mes devis réutilise le parcours de réponse existant ; recherche par intitulé ou événement, sans accents ni casse, cumulée au filtre par statut ; compteur de résultats ; anciens liens `/devis` redirigés en conservant les paramètres. |
| CLI-03 | Compte et coordonnées dans deux formulaires ; champs obligatoires, longueurs et e-mails contrôlés ; le mot de passe actuel est demandé uniquement pour changer l’e-mail de connexion. |
| CLI-04 | Mot de passe et confirmation explicite pour supprimer le compte ; état de connexion vidé uniquement après succès ; retour à l’accueil avec message. Sur 503, le client reste connecté, voit le message et peut réessayer. |
| CLI-06 | Avis uniquement sur événement terminé et non encore évalué ; note de 1 à 5, commentaire non vide de 2 000 caractères au plus, compteur ; envoi unique ; statut de modération affiché. |
| CLI-07 | Donner ou retirer l’accord, date affichée ; explication du rôle de la visibilité et du statut ; en cas d’échec du serveur, interrupteur rétabli sur l’état enregistré. |
| PUB-07 | Catalogue public : filtres période, type, thème et tri conservés dans l’URL, pagination ; seuls `du`, `au`, `type`, `theme`, `tri` et `page` sont transmis à l’API et conservés par les liens de pagination ; les paramètres inconnus d’un lien partagé sont ignorés ; images avec alternative et repli ; statut Annulé visible ; aucun prix. |
| PUB-08 | Détail public avec dates, lieu, type, thème, image et statut ; section « Prestations et Devis » vers la demande ; message et retour sur 404. |
| PUB-09 | Avis publiés : événement, note « N sur 5 », date et commentaire ; aucune identité de client affichée. |
| ADM-01 | Cartes à en-tête, listes sans puces, noms, clients, dates et badges ; chiffres clés clients actifs et brouillons en valeurs distinctes. Les dates et statuts complémentaires viennent de la route existante `/evenements`. |
| TR-04 | Confidentialité : effacement et sessions décrits au présent, refus temporaire de suppression si les journaux sont indisponibles, purges de trois ans / un an / 180 jours et reprise après veille ; envoi Brevo vérifié. |

Le suivi de l’accueil porte sur les demandes rattachées à la fiche. Il ne rapproche pas les demandes non converties par e-mail : l’adresse d’un compte n’est pas vérifiée.

## Commandes

| Commande depuis `apps/web` | Résultat | Preuve |
| --- | --- | --- |
| `npm.cmd ci` | OK : 432 paquets installés, sans erreur ; `package.json` et lockfile inchangés | Sortie de la commande |
| `npm.cmd run format:check` | OK : `All matched files use Prettier code style!` | Sortie de la commande |
| `npm.cmd run lint` | OK : `All files pass linting.` | Sortie de la commande |
| `npm.cmd run typecheck` | OK : aucune erreur (application et tests) | Sortie de la commande |
| `npm.cmd run test:coverage` | OK : 12 fichiers, 179 tests réussis sur 179 ; couverture : lignes 82,49 %, instructions 80,74 %, branches 74,42 %, fonctions 66,94 % | Sortie de la commande, `coverage/` |
| `npm.cmd run build` | OK : compilation vers `dist/web/`, sans avertissement de budget ; bundle initial 311,08 kB (86,09 kB transférés) | `dist/web/` |
| `npm.cmd audit --omit=dev --audit-level=high` | OK : `found 0 vulnerabilities` | Sortie de la commande |
| CI de la PR : trois jobs de validation | à compléter | |

## Tests applicatifs concernés

| Fichier | Vérifications principales | Résultat |
| --- | --- | --- |
| `pages/espace/espace-client.spec.ts` | Quatre rubriques et rubrique active ; un seul titre principal ; redirections de rôle et visiteur ; paramètres conservés ; widget, suivi, vide, chargement et erreurs ; avis et double envoi ; accord donné, retiré et erreur ; profil, validation, mot de passe et erreur 409 ; effacement du message de mot de passe après changement d’e-mail ; suppression confirmée, succès et refus 503 ; message de retour à l’accueil | OK : 27 tests réussis |
| `pages/catalogue/catalogue.spec.ts` | Informations publiques, absence de prix, Annulé ; filtres et pagination dans l’URL ; paramètres inconnus ignorés au chargement, à la reprise et dans les liens ; nouvelle recherche, réinitialisation, erreurs et reprise ; réponse tardive ignorée ; détail, 404 et identifiant invalide ; images absentes ou inaccessibles ; avis sans identité ; chiffres et badges du tableau de bord ; séparateur de contact absent pour un client anonymisé sans nom | OK : 17 tests réussis |
| `pages/devis/devis.spec.ts` | Parcours existant et recherche cumulée au statut, réinitialisation sans appel supplémentaire | OK : 5 tests réussis |
| `pages/gestion/organisation-espaces.spec.ts`, `gestion.spec.ts` | Navigation de l’équipe conservée, nouveau chemin client des devis, indicateurs en valeurs | OK : 34 et 19 tests réussis |
| `app.spec.ts` | Gabarit du site et confidentialité cohérente avec les traitements | OK : 31 tests réussis |

Les tests du web simulent les réponses HTTP. Ils ne remplacent pas les parcours suivants sur la pile complète.

## Parcours sur la pile locale

Utiliser uniquement des données fictives. Préparer une demande convertie, des devis envoyés, un événement terminé, un événement publié et un avis validé. La suppression doit être testée sur un compte jetable distinct.

| N° | Parcours et résultat attendu | Résultat | Preuve |
| --- | --- | --- | --- |
| W1 | Client : les quatre rubriques restent visibles sur chaque page ; rubrique active pleine et `aria-current`; un seul h1 ; visite directe d’une rubrique après rechargement. | OK : quatre rubriques visibles sur chaque page, rubrique active pleine, rubrique conservée après rechargement | Constat manuel ; `aria-current` et titre unique couverts par `espace-client.spec.ts` |
| W2 | Accueil : trois événements les plus proches, dates lisibles ; étapes de la demande et statuts des devis envoyés ; un compte sans fiche affiche un cas vide. | OK : « Prochains événements » limité à trois, triés par date, annulé et terminé exclus ; suivi en quatre étapes (demande reçue, prise en charge, événement, devis envoyé avec sa date) ; compte sans fiche : cas vide et lien « Demander un devis » | Constat manuel, pile locale, 17/11/2026 |
| W3 | Mes devis : recherche par intitulé puis événement, accents ignorés ; statut cumulé ; réinitialisation ; PDF et réponse au devis toujours fonctionnels ; `/devis?proposition=…` conserve son paramètre. | OK : recherche par intitulé puis par événement sans accents, statut cumulé, réinitialisation ; PDF ouvert ; devis accepté ; `/devis?proposition=1` redirigé vers `/espace/devis?proposition=1` | Constat manuel, pile locale, 17/11/2026 |
| W4 | Mon profil : modifier le prénom puis les coordonnées ; recharger et vérifier la persistance ; changer l’e-mail exige le mot de passe actuel ; doublon affiché en erreur ; les coordonnées commerciales et l’identité du compte restent distinctes. | OK : prénom et téléphone conservés après rechargement ; changement d’e-mail sans mot de passe refusé ; e-mail déjà utilisé refusé (doublon) ; compte et coordonnées dans deux formulaires distincts | Constat manuel, pile locale, 17/11/2026 |
| W5 | Mes événements : un événement terminé permet un avis unique ; une note manquante ou un commentaire vide sont refusés ; envoi confirmé, statut En attente ; après modération par l’équipe, avis public avec note, date et événement sans nom du client. | OK : note manquante et commentaire vide refusés ; double clic : un seul avis, statut « En attente » ; après validation par l’équipe, `/avis` affiche « 4 sur 5 », la date et l’événement, sans nom de client ni d’entreprise | Constat manuel, pile locale, 17/11/2026 |
| W6 | Donner l’accord, cocher la visibilité côté admin : événement public ; retirer l’accord : événement retiré du catalogue et détail en 404 ; en brouillon, il reste exclu. | OK : accord donné sur quatre événements visibles ; terminé et annulé publiés, brouillon exclu ; accord retiré : événement absent du catalogue et détail « Événement introuvable » | Constat manuel ; base locale : événement retiré avec `visible_public` vrai et `date_accord_publication` vide |
| W7 | Catalogue : filtres période, type et thème ; tri ; pagination ; actualisation et retour navigateur conservent les filtres ; image invalide remplacée par un repli ; événement annulé annoncé comme tel ; aucun prix dans la liste ni le détail. | OK : filtres période, type et thème, deux tris, filtres conservés au rechargement et au retour ; image invalide remplacée par le repli ; « Annulé » affiché ; aucun prix. Pagination non observable (moins de 12 événements publiés) | Constat manuel ; pagination couverte par `catalogue.spec.ts` |
| W8 | Détail : dates, lieu, type et thème ; section Prestations et Devis vers la demande ; événement inconnu ou non publié : message et retour au catalogue. | OK : dates, lieu, type, thème et section « Prestations et Devis » vers `/demande-devis` ; identifiant inconnu : message et retour au catalogue | Constat manuel, pile locale, 17/11/2026 |
| W9 | Admin : compteurs clients actifs et brouillons exacts ; quatre cartes à en-tête ; listes sans puces, dates et badges ; notes globales conservées. | OK : clients actifs et brouillons conformes aux listes ; quatre cartes à en-tête ; listes sans puces avec dates et badges ; notes globales conservées | Constat manuel, pile locale, 17/11/2026 |
| W10 | Effacement d’un compte jetable : mot de passe et confirmation obligatoires ; succès : retour à l’accueil avec message, connexion refusée ensuite ; contrôles SQL et MongoDB selon le rapport API. | OK : suppression refusée sans mot de passe et sans confirmation ; succès : retour à l’accueil avec message ; reconnexion refusée | PostgreSQL : fiche 4 avec `entreprise`, `email_contact` et `id_utilisateur` vides, `date_anonymisation` renseignée ; MongoDB : `CREATION_CLIENT` et `EFFACEMENT_CLIENT` réduits à `{ id_client: '4' }`, aucun `nom_client` |
| W11 | `docker compose stop mongo` puis effacement d’un compte avec fiche : message de refus, client toujours connecté, données conservées. `docker compose start mongo` puis nouvelle demande : succès. | OK : client connecté avant l’arrêt de MongoDB ; message de refus, client toujours connecté après rechargement ; après `docker compose start mongo`, suppression réussie et reconnexion refusée. Pendant l’arrêt, une nouvelle connexion est impossible : le journal de connexion est obligatoire | PostgreSQL pendant l’arrêt : fiche 5 intacte (`entreprise` et `id_utilisateur` renseignés) |
| W12 | Admin et employé : accès direct à `/espace/profil` renvoyé vers leur espace ; visiteur : connexion avec destination conservée. | OK : administratrice renvoyée vers l’administration ; visiteur renvoyé vers la connexion puis vers « Mon profil » après connexion du client | Constat manuel ; cas de l’employé couvert par `espace-client.spec.ts` |
| W13 | Confidentialité : suppression, sessions, trois ans / un an / 180 jours, reprise après veille et limites des prestataires lisibles. | OK : suppression du compte, sessions, durées de 3 ans, 1 an et 180 jours, reprise après la veille et prestataires décrits | Constat manuel, pile locale, 17/11/2026 |
| W14 | Ouvrir `/evenements?fbclid=test`, puis un lien comportant les six filtres et un paramètre inconnu : événements affichés ; filtres et page conservés, paramètre inconnu absent des appels API et des liens de pagination ; « Réessayer le chargement » applique la même sélection. | OK : `/evenements?fbclid=test` affiche les événements publiés | Constat manuel ; paramètres inconnus absents des appels et des liens, « Réessayer le chargement » : couverts par `catalogue.spec.ts` |
| W15 | Tableau de bord : un événement d’un client anonymisé affiche « Client anonymisé » sans séparateur vide. Profil : provoquer le message demandant le mot de passe pour un nouvel e-mail, puis rétablir l’ancien e-mail ; le message et le champ de mot de passe disparaissent. | OK : événement d’une fiche anonymisée affiché « Client anonymisé » sans séparateur vide ; message et champ de mot de passe retirés quand l’e-mail d’origine est rétabli | Constat manuel, pile locale, 17/11/2026 |

## Clavier, affichage et accessibilité

| N° | Contrôle | Résultat | Preuve |
| --- | --- | --- | --- |
| A1 | Tab et Maj+Tab sur les quatre rubriques et le catalogue : ordre logique, focus violet visible et non coupé ; Entrée sur les liens et boutons. | OK : ordre logique et contour violet visible sur « Mes événements » | Constat manuel |
| A2 | Avis : groupe de radios avec légende et libellés ; flèches changent la note ; zone de commentaire étiquetée ; erreur reliée au formulaire et au champ ; après succès, focus sur le titre Mon avis. | Non refait à la main | Couvert par `espace-client.spec.ts` (groupe de radios, erreurs reliées, focus sur « Mon avis » après succès) |
| A3 | Accord : activation avec Espace, état annoncé et date lisible ; suppression : mot de passe, confirmation et bouton danger accessibles au clavier. | Non refait à la main | Accord et confirmation de suppression couverts par `espace-client.spec.ts` |
| A4 | Lecteur d’écran : statuts écrits en clair, chargements et confirmations annoncés, compteurs de recherche, note « N sur 5 », alternatives des images. | Non réalisé : lecteur d’écran non disponible sur le poste | Statuts en clair, annonces `role="status"` et note « N sur 5 » couverts par les tests |
| A5 | Largeurs 375 px, 768 px et ordinateur ; zoom 200 % et 400 % ; pas de débordement horizontal, hors tableau des devis disposant de sa région de défilement nommée. | OK à 375 px sur `/evenements` et `/espace` : aucun débordement horizontal ; 768 px et zoom non contrôlés | Constat manuel, pile locale, 17/11/2026 |
| A6 | Lighthouse et axe sur `/evenements` et `/espace` : relever les résultats et corriger les anomalies ; contrôle manuel des contrastes et des cibles de 44 px. | OK : Lighthouse Accessibilité 100 sur `/evenements` et sur `/espace` (navigation, ordinateur). Relevé aussi : Performance 83 et 73, Bonnes pratiques 96 et 100, SEO 54 et 54 ; décalage de mise en page de 0,317 sur `/espace` | Lighthouse de Chrome (règles axe-core) ; extension axe non utilisée séparément |

## Limites à conserver lors de la validation

- Le test end-to-end du parcours de demande de devis et le plan général de tests sont suivis séparément.
- Le refus 503 impose une nouvelle demande d’effacement après rétablissement ; le web n’annonce pas de succès et ne ferme pas la session dans ce cas.
- Les images de couverture sont celles des événements ; aucun nouveau visuel externe n’est ajouté au code.
