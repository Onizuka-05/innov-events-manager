# Tableau des tests, regroupés par fonctionnalité (TST-04)

Généré par `node outils/tableau-des-tests.mjs` depuis la racine du dépôt, à partir des fichiers `*.spec.ts` de l’API (`services/api`), du site web (`apps/web`) et de l’application mobile (`apps/mobile`). Ne pas modifier à la main : relancer le script après chaque ajout de test.

Niveaux : **unitaire** (fonction, service ou composant isolé, dépendances simulées) ; **intégration** (API Express complète avec Supertest sur une base PostgreSQL réelle et jetable, ou nginx réel) ; **bout en bout** (navigateur Playwright ; pile Docker Compose réelle pour le web, API simulée pour le mobile). Un test paramétré compte autant de cas que d’entrées dans son tableau. Les tests d’intégration de l’API et de nginx sont ignorés sans base de test ou sans nginx : le nombre exécuté peut donc être inférieur sur un poste qui n’a pas ces services.

## Synthèse

| Fonctionnalité | Unitaire | Intégration | Bout en bout | Total |
| --- | ---: | ---: | ---: | ---: |
| [Socle technique](#socle-technique) | 27 | 0 | 0 | 27 |
| [Sécurité et contrôle des accès](#sécurité-et-contrôle-des-accès) | 21 | 29 | 0 | 50 |
| [Authentification et comptes](#authentification-et-comptes) | 13 | 26 | 0 | 39 |
| [Site public, demande de devis et contact](#site-public-demande-de-devis-et-contact) | 56 | 28 | 2 | 86 |
| [Devis et événements](#devis-et-événements) | 23 | 28 | 0 | 51 |
| [Espace de l’équipe et administration](#espace-de-léquipe-et-administration) | 75 | 22 | 0 | 97 |
| [Espace client](#espace-client) | 28 | 33 | 0 | 61 |
| [Journaux et purges des données](#journaux-et-purges-des-données) | 5 | 3 | 0 | 8 |
| [Application mobile](#application-mobile) | 58 | 1 | 3 | 62 |
| **Total** | **306** | **170** | **5** | **481** |

## Socle technique

27 tests.

| Fichier | Test | Niveau | Cas |
| --- | --- | --- | ---: |
| `apps/web/src/app/core/api.service.spec.ts` | Appels API et destination de connexion › joint le jeton de la session courante en %s | Unitaire | 3 |
| `apps/web/src/app/core/api.service.spec.ts` | Appels API et destination de connexion › redemande un jeton apres chaque changement de session | Unitaire | 1 |
| `apps/web/src/app/core/api.service.spec.ts` | Appels API et destination de connexion › refuse une destination non autorisee : %s | Unitaire | 6 |
| `apps/web/src/app/core/api.service.spec.ts` | Appels API et destination de connexion › conserve le chemin interne, ses parametres et son ancre | Unitaire | 1 |
| `services/api/src/config/config.spec.ts` | chargerConfiguration › ne fait confiance a aucun proxy par defaut | Unitaire | 1 |
| `services/api/src/config/config.spec.ts` | chargerConfiguration › refuse un secret de session de moins de 32 caracteres | Unitaire | 1 |
| `services/api/src/config/config.spec.ts` | chargerConfiguration › exige un secret proxy valide sans divulguer sa valeur | Unitaire | 1 |
| `services/api/src/config/config.spec.ts` | chargerConfiguration › exige DATABASE_URL ou PGPASSWORD | Unitaire | 1 |
| `services/api/src/config/config.spec.ts` | chargerConfiguration › refuse une valeur numerique hors plage | Unitaire | 1 |
| `services/api/src/config/config.spec.ts` | chargerConfiguration › active le mode production uniquement si NODE_ENV vaut production | Unitaire | 1 |
| `services/api/src/config/config.spec.ts` | chargerConfiguration › exige MONGODB_URL en production, sans repli sur localhost | Unitaire | 1 |
| `services/api/src/config/config.spec.ts` | chargerConfiguration › active les purges automatiques par defaut, desactivables par configuration | Unitaire | 1 |
| `services/api/src/routes/sante.routes.spec.ts` | GET /api/sante › retourne 200 quand les deux bases repondent | Unitaire | 1 |
| `services/api/src/routes/sante.routes.spec.ts` | GET /api/sante › ne crée pas de session (aucun cookie) | Unitaire | 1 |
| `services/api/src/routes/sante.routes.spec.ts` | GET /api/sante › retourne 503 sans divulguer les erreurs SQL | Unitaire | 1 |
| `services/api/src/routes/sante.routes.spec.ts` | GET /api/sante › retourne 503 si MongoDB ne repond pas | Unitaire | 1 |
| `services/api/src/routes/sante.routes.spec.ts` | GET /api/sante › ne repond pas OK quand les deux bases sont indisponibles | Unitaire | 1 |
| `services/api/src/routes/sante.routes.spec.ts` | GET /api/sante › ecrit une ligne JSON neutre sur stdout a chaque 503 | Unitaire | 1 |
| `services/api/src/services/courriels.service.spec.ts` | Envoi Brevo par HTTPS › construit un message texte avec l’expediteur configure et le bon destinataire | Unitaire | 1 |
| `services/api/src/services/courriels.service.spec.ts` | Envoi Brevo par HTTPS › ne transmet aucun detail d’erreur du fournisseur | Unitaire | 1 |

## Sécurité et contrôle des accès

50 tests.

| Fichier | Test | Niveau | Cas |
| --- | --- | --- | ---: |
| `services/api/src/middlewares/acces-proxy.middleware.spec.ts` | Acces a l API par le proxy › refuse une requete sans en-tete | Unitaire | 1 |
| `services/api/src/middlewares/acces-proxy.middleware.spec.ts` | Acces a l API par le proxy › refuse un en-tete incorrect | Unitaire | 1 |
| `services/api/src/middlewares/acces-proxy.middleware.spec.ts` | Acces a l API par le proxy › accepte un en-tete correct | Unitaire | 1 |
| `services/api/src/middlewares/acces-proxy.middleware.spec.ts` | Acces a l API par le proxy › autorise la sante sans en-tete, sans creer de cookie | Unitaire | 1 |
| `services/api/src/middlewares/acces-proxy.middleware.spec.ts` | Acces a l API par le proxy › ne contourne pas le controle pour une autre methode ou une autre URL | Unitaire | 1 |
| `services/api/src/middlewares/erreurs.middleware.spec.ts` | Gestionnaire central des erreurs › repond 404 sans detail pour une route absente | Unitaire | 1 |
| `services/api/src/middlewares/erreurs.middleware.spec.ts` | Gestionnaire central des erreurs › repond 400 pour un JSON mal forme, sans detail technique | Unitaire | 1 |
| `services/api/src/middlewares/erreurs.middleware.spec.ts` | Gestionnaire central des erreurs › repond 413 pour un corps superieur a 32 ko | Unitaire | 1 |
| `services/api/src/middlewares/ip-client.middleware.spec.ts` | IP dediee provenant du proxy authentifie › accepte une IP simple valide : %s | Unitaire | 3 |
| `services/api/src/middlewares/ip-client.middleware.spec.ts` | IP dediee provenant du proxy authentifie › refuse une valeur ambigue : %s | Unitaire | 5 |
| `services/api/src/middlewares/ip-client.middleware.spec.ts` | IP dediee provenant du proxy authentifie › ne se replie pas sur CF-Connecting-IP ou X-Forwarded-For | Unitaire | 1 |
| `services/api/src/routes/csrf.routes.spec.ts` | Protection CSRF › fournit un jeton et un cookie de session httpOnly | Unitaire | 1 |
| `services/api/src/routes/csrf.routes.spec.ts` | Protection CSRF › refuse une requete modifiante sans jeton | Unitaire | 1 |
| `services/api/src/routes/csrf.routes.spec.ts` | Protection CSRF › refuse un jeton qui ne correspond pas a la session | Unitaire | 1 |
| `services/api/src/routes/csrf.routes.spec.ts` | Protection CSRF › laisse passer une requete modifiante avec le jeton de sa session | Unitaire | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › matrice d acces de toutes les routes › applique le code attendu a chaque route pour le role %s | Intégration | 4 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › matrice d acces de toutes les routes › couvre chaque route declaree par les routeurs de l API | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › regenere le cookie, renouvelle le CSRF et ne renvoie aucun hache | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › bloque %s %s pour une session restreinte | Intégration | 9 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › refuse une session restreinte apres 15 minutes meme si son cookie est presente | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › une nouvelle demande d’oubli invalide la session restreinte precedente | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › CSRF obligatoire sur %s %s | Intégration | 8 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › ignore CF-Connecting-IP et X-Forwarded-For forges dans l’API | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › limitation de connexion fondee sur la meme IP dediee, pas les en-tetes forges | Intégration | 1 |
| `services/api/src/routes/nginx.integration.spec.ts` | IP a travers nginx reel › %s ecrase les IP et le secret forges avant la journalisation | Intégration | 2 |

## Authentification et comptes

39 tests.

| Fichier | Test | Niveau | Cas |
| --- | --- | --- | ---: |
| `apps/web/src/app/core/authentification.guard.spec.ts` | Destination conservee avant connexion › redirige vers la connexion avec la destination demandee | Unitaire | 1 |
| `apps/web/src/app/core/authentification.guard.spec.ts` | Destination conservee avant connexion › redirige une session restreinte vers le renouvellement en conservant la destination | Unitaire | 1 |
| `apps/web/src/app/core/authentification.guard.spec.ts` | Acces aux espaces de gestion › role %s equipe=%s autorise=%s | Unitaire | 6 |
| `apps/web/src/app/pages/authentification/authentification.spec.ts` | Parcours de connexion › retrouve l’action demandee apres la connexion normale | Unitaire | 1 |
| `apps/web/src/app/pages/authentification/authentification.spec.ts` | Parcours de connexion › passe d’abord par le renouvellement avec la destination conservee | Unitaire | 1 |
| `apps/web/src/app/pages/authentification/authentification.spec.ts` | Parcours de connexion › permet d’abandonner la session temporaire avant un nouvel oubli | Unitaire | 1 |
| `apps/web/src/app/pages/authentification/authentification.spec.ts` | Parcours de connexion › conserve la destination pendant le detour par le mot de passe oublie | Unitaire | 1 |
| `apps/web/src/app/pages/authentification/authentification.spec.ts` | Parcours de connexion › conserve la destination quand la session temporaire est abandonnee | Unitaire | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › inscrit uniquement un client, hache Argon2id et envoie une confirmation sans mot de passe | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › refuse l’injection du role %s a l’inscription | Intégration | 2 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › verifie la complexite cote serveur : %s | Intégration | 5 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › ne distingue pas une inscription deja existante dans la reponse | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › ne distingue pas compte inexistant, mot de passe faux et compte suspendu | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › donne une seule reussite a deux connexions temporaires concurrentes, sur PostgreSQL reel | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › refuse la reutilisation apres abandon et conserve le mot de passe permanent | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › enregistre le nouveau hache, efface le temporaire et invalide l’ancienne session normale | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › ferme la session de recuperation de l ancienne adresse au changement d adresse | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › n envoie pas de temporaire a l ancienne adresse si l adresse change pendant la demande | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › oubli : meme reponse, expiration une heure, mot de passe permanent conserve | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › controle chaque route protegee pour le role %s | Intégration | 3 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › refuse %s %s sans session authentifiee | Intégration | 4 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › relit le role et le statut : une session n’accorde pas des droits perimes | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › le script cree un seul admin et aucune route publique ne le remplace | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › conserve les sessions dans PostgreSQL avec le role applicatif | Intégration | 1 |

## Site public, demande de devis et contact

86 tests.

| Fichier | Test | Niveau | Cas |
| --- | --- | --- | ---: |
| `apps/web/e2e/demande-devis.spec.ts` | envoie la demande, affiche le remerciement et notifie l’adresse de contact | Bout en bout | 1 |
| `apps/web/e2e/demande-devis.spec.ts` | refuse une demande incomplete : message d’erreur, aucun envoi, aucun e-mail | Bout en bout | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › presente un seul titre principal et deux illustrations locales decrites | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › dirige le bouton principal vers la route de demande de devis sans simuler un envoi | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › expose les six entrees de navigation et marque seulement la page courante | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › remplace Connexion par Mon espace et Deconnexion pour un utilisateur connecte | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › ouvre le menu avec un bouton et le referme avec Echap en rendant le focus | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › atteint le contenu depuis une page legale sans revenir a l’accueil | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › referme le menu et place le focus sur le contenu apres navigation | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › ferme le menu et place le focus sur le contenu en choisissant la page courante | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › garde le gabarit et un titre coherent sur %s | Unitaire | 11 |
| `apps/web/src/app/app.spec.ts` | Site public › actualise le texte quand Angular reutilise le composant des pages legales | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › ouvre la page %s depuis le pied de page | Unitaire | 4 |
| `apps/web/src/app/app.spec.ts` | Site public › decrit les traitements en place et les limites de conservation | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › propose Administration sans Demander un devis a l’equipe (%s) | Unitaire | 2 |
| `apps/web/src/app/app.spec.ts` | Site public › garde Mon espace et Demander un devis pour le client | Unitaire | 1 |
| `apps/web/src/app/app.spec.ts` | Site public › ouvre un seul menu compact, rubriques de l’equipe en premier (%s) | Unitaire | 2 |
| `apps/web/src/app/app.spec.ts` | Site public › referme le menu compact apres le choix d’une rubrique de l’equipe | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Catalogue public et URL › ignore un parametre inconnu dans l adresse et les liens de pagination | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Catalogue public et URL › affiche les informations publiques, le statut annule et aucun prix | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Catalogue public et URL › restaure les filtres de l URL et les preserve pendant la pagination | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Catalogue public et URL › reflete une recherche dans l URL et repart de la premiere page | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Catalogue public et URL › annonce le cas vide sans carte | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Catalogue public et URL › affiche une erreur des filtres invalides sans la remplacer par un cas vide | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Catalogue public et URL › ignore une ancienne reponse recue apres une recherche plus recente | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Catalogue public et URL › annonce le chargement sans afficher de resultat vide | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Reprise du chargement public › retente la meme URL apres une indisponibilite temporaire | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Detail public et couvertures › contient les informations et une section Prestations et Devis avec son lien | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Detail public et couvertures › affiche le 404 puis charge un autre identifiant sans conserver l ancien evenement | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Detail public et couvertures › refuse un identifiant invalide sans appeler l API | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Detail public et couvertures › remplace une image absente, non HTTPS ou inaccessible par un repli | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Avis publics et tableau de bord › reserve le separateur de contact aux clients dont le nom est renseigne | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Avis publics et tableau de bord › affiche note, date et evenement sans nom de client | Unitaire | 1 |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Avis publics et tableau de bord › affiche le cas vide des avis puis les erreurs de lecture | Unitaire | 1 |
| `apps/web/src/app/pages/formulaires.spec.ts` | Formulaires publics › reprend les champs, titres, etapes et libelles de W1 | Unitaire | 1 |
| `apps/web/src/app/pages/formulaires.spec.ts` | Formulaires publics › n’envoie pas une demande incomplete et signale les champs invalides | Unitaire | 1 |
| `apps/web/src/app/pages/formulaires.spec.ts` | Formulaires publics › envoie les types numeriques et affiche uniquement le message recu apres succes | Unitaire | 1 |
| `apps/web/src/app/pages/formulaires.spec.ts` | Formulaires publics › conserve les saisies si l’enregistrement echoue | Unitaire | 1 |
| `apps/web/src/app/pages/formulaires.spec.ts` | Formulaires publics › verifie l’e-mail conditionnel du contact | Unitaire | 1 |
| `apps/web/src/app/pages/formulaires.spec.ts` | Formulaires publics › affiche un message comme texte, sans executer son contenu HTML | Unitaire | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › catalogue public des evenements › ne publie que les evenements visibles, avec accord et hors brouillon, sans prix | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › catalogue public des evenements › filtre par periode, type et theme, trie et pagine | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › catalogue public des evenements › refuse le parametre invalide %s | Intégration | 12 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › catalogue public des evenements › refuse un identifiant de detail invalide | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › contact : e-mail obligatoire sans identifiant, visiteur et client admis | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › devis : statut impose, notification et message admin dans les demandes suivantes | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › devis : champ obligatoire %s controle sur le serveur | Intégration | 10 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › devis : refuse date impossible, nombre fractionnaire, type absent et injection de statut | Intégration | 1 |
| `services/api/src/services/formulaires.service.spec.ts` | Demande de devis (service, unitaire) › enregistre la demande avant de notifier l’adresse de contact, puis renvoie le remerciement | Unitaire | 1 |
| `services/api/src/services/formulaires.service.spec.ts` | Demande de devis (service, unitaire) › refuse un type d’evenement indisponible sans rien enregistrer ni envoyer | Unitaire | 1 |
| `services/api/src/services/formulaires.service.spec.ts` | Demande de devis (service, unitaire) › conserve la demande si l’e-mail echoue et le signale sans donnee personnelle | Unitaire | 1 |

## Devis et événements

51 tests.

| Fichier | Test | Niveau | Cas |
| --- | --- | --- | ---: |
| `apps/web/src/app/core/statuts.spec.ts` | Statuts et badges › reprend exactement la table des familles de la charte | Unitaire | 1 |
| `apps/web/src/app/core/statuts.spec.ts` | Statuts et badges › donne un libelle a chaque statut de la table et garde les roles a part | Unitaire | 1 |
| `apps/web/src/app/core/statuts.spec.ts` | Statuts et badges › affiche %s en clair avec la classe %s | Unitaire | 8 |
| `apps/web/src/app/core/statuts.spec.ts` | Statuts et badges › distingue Brouillon et En cours | Unitaire | 1 |
| `apps/web/src/app/core/statuts.spec.ts` | Statuts et badges › affiche un statut inconnu tel quel, en neutre | Unitaire | 1 |
| `apps/web/src/app/pages/devis/devis.spec.ts` | parcours devis › affiche la rubrique devis au client | Unitaire | 1 |
| `apps/web/src/app/pages/devis/devis.spec.ts` | parcours devis › ne montre pas de formulaire de conversion au client | Unitaire | 1 |
| `apps/web/src/app/pages/devis/devis.spec.ts` | parcours devis › affiche les outils de gestion à l’administrateur | Unitaire | 1 |
| `apps/web/src/app/pages/devis/devis.spec.ts` | parcours devis › ne conserve pas la conversion dans la rubrique Devis | Unitaire | 1 |
| `apps/web/src/app/pages/devis/devis.spec.ts` | Recherche des propositions du client › cumule recherche sans accents et filtre par statut sans appel supplementaire | Unitaire | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › controle chaque route administrateur pour les roles client et employe | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse la consultation du devis a un employe | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse la reponse a un devis a un employe et a un administrateur | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › cache le devis du client A au client B y compris le PDF et la reponse | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse toutes les routes sensibles sans session | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › interdit toute mutation sans jeton CSRF | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › interdit la conversion d un prospect echoue | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › ne duplique pas une conversion simultanee | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse un devis en preparation au client rattache | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › accepte une reponse et refuse les autres devis dans la transaction | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse un brouillon jamais envoye a l acceptation et le masque au client | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › rattache une seconde demande du meme e-mail a la fiche existante, puis envoie le devis | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › laisse la demande a contacter si le message de classement echoue, puis accepte un nouvel essai | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › garde l acceptation et trace l echec de la notification a Innov Events | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › envoie le PDF, cree le compte temporaire et journalise le devis | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › annule le compte et le statut si le courriel du devis echoue | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › remplace le mot de passe d un compte inscrit avec l e-mail du contact avant de le rattacher | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse la reponse d une session ouverte avant le rattachement du compte au devis | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › reutilise le compte deja rattache si son email differe du contact | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse une image d evenement non HTTPS sans creer l evenement | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse l envoi d un devis sans prestation sans modifier son etat | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › renvoie une contre proposition apres une demande de modification avec motif | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse l acceptation et la modification d un devis envoye si l evenement est %s | Intégration | 2 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › repond 409 au client qui accepte le devis d un evenement annule | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › refuse l envoi d un devis si l evenement est annule ou termine | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › n entre pas en interblocage avec la suppression de la fiche pendant l envoi | Intégration | 1 |
| `services/api/src/routes/j8.integration.spec.ts` | J8 avec PostgreSQL reel › une seule acceptation concurrente reussit | Intégration | 1 |
| `services/api/src/services/devis.service.spec.ts` | devis › additionne les lignes HT | Unitaire | 1 |
| `services/api/src/services/devis.service.spec.ts` | devis › calcule la TVA | Unitaire | 1 |
| `services/api/src/services/devis.service.spec.ts` | devis › calcule le total TTC | Unitaire | 1 |
| `services/api/src/services/devis.service.spec.ts` | devis › refuse de divulguer la fiche si le client ne la possede pas | Unitaire | 1 |
| `services/api/src/services/devis.service.spec.ts` | devis › autorise la consultation administrateur | Unitaire | 1 |
| `services/api/src/services/devis.service.spec.ts` | devis › journalise une reponse de devis | Unitaire | 1 |

## Espace de l’équipe et administration

97 tests.

| Fichier | Test | Niveau | Cas |
| --- | --- | --- | ---: |
| `apps/web/src/app/pages/catalogue/catalogue.spec.ts` | Avis publics et tableau de bord › presente les chiffres en valeur, les dates et les badges depuis les routes existantes | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › conserve les notes sur le tableau de bord sans la liste des prospects | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › recherche un client et montre son historique sans edition employe | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › cree une fiche avec les champs du contrat API | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › ne propose pas de modification structurelle a l’employe sur un evenement | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › ne montre pas la progression de la tache d’un autre compte meme a l’admin | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › demarre sa propre tache en conservant les noms SQL dans le JSON | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › reinitialise les formulaires au changement d’evenement et cree la note sur le nouveau projet | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › envoie la validation d’un avis | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › protege l’admin dans la liste des comptes | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › le tableau des prospects dirige vers la conversion | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › la vue des devis acceptes permet de passer l’evenement en cours | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › affiche des journaux lisibles avec l’identifiant de l’utilisateur | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › garde le numero du compte si la liste des comptes est indisponible | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › reformule les details sans perdre une cle inconnue | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › ne met plus de lien Tableau de bord en tete (%o) | Unitaire | 2 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › affiche le nom de l’evenement sur chaque carte de tache | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › affiche les statuts en badges aux couleurs d’etat | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | espaces de gestion › respecte la hierarchie des boutons : un primaire par zone, les autres a contour | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/navigation-equipe.spec.ts` | Menu equipe › affiche %s : %i liens | Unitaire | 3 |
| `apps/web/src/app/pages/gestion/navigation-equipe.spec.ts` | Menu equipe › n’a plus de bouton de menu propre : le menu compact est celui de l’en-tete | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › garde le menu, un seul h1 et le titre de la rubrique %s | Unitaire | 10 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › limite le menu employe a quatre rubriques | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › ne montre aucun menu equipe au client | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › renvoie l’employe depuis la rubrique admin %s | Unitaire | 6 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › ouvre l’accueil %s apres connexion | Unitaire | 3 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › redirige /espace pour %s | Unitaire | 2 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › conserve la destination equipe demandee avant connexion | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › reserve /devis au client et redirige %s | Unitaire | 3 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › redirige le message de remerciement vers Parametres | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › conserve les anciennes adresses equipe et l’identifiant de fiche | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › convertit puis relit et preremplit l’evenement (client existant=%s) | Unitaire | 2 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › relit les fiches et redemande la confirmation si la fiche a rattacher a change | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › annule la confirmation si la fiche affichee change apres un classement sans suite | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › refuse de preremplir un evenement depuis une demande non convertie | Unitaire | 1 |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | Organisation des espaces › liste les taches selon le compte %s | Unitaire | 2 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › controle chaque route pour %s, y compris heritage employe | Intégration | 4 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › journalise creation modification suppression avec les noms requis | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › detruit toutes les sessions du compte %s suspendu et refuse la connexion | Intégration | 2 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › supprime logiquement un employe, garde ses notes et taches terminees et reaffecte les autres | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › supprime un compte client en conservant evenements devis avis et retire notes et demandes | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › reserve le statut de tache a son affecte meme face a un admin et impose le cycle | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › protege les notes des autres auteurs et les notes globales | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › permet la consultation employe sans modification structurelle et garde historique et recherche | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › verifie le tableau de bord, trois prochains tries, cinq notes et clients actifs dedupliques | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › filtre les evenements a venir pour mobile et les trie | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › ne publie que les avis valides apres moderation par employe ou admin | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › cree les comptes employes et clients sans fuite de hache ni elevation admin | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › cree un compte %s temporaire par email et impose le renouvellement | Intégration | 2 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › annule creation et rattachement si le courriel echoue | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › projette les dates de gestion au format ISO avec T | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › modifie les evenements selon le cycle, refuse suppression avec devis et journalise les statuts | Intégration | 1 |
| `services/api/src/routes/j9.integration.spec.ts` | J9 avec PostgreSQL reel et sessions persistantes › filtre les journaux par action et refuse les objets injectes | Intégration | 1 |
| `services/api/src/services/gestion.service.spec.ts` | cycles des statuts › autorise %s vers %s | Unitaire | 6 |
| `services/api/src/services/gestion.service.spec.ts` | cycles des statuts › refuse %s vers %s | Unitaire | 4 |
| `services/api/src/services/gestion.service.spec.ts` | cycles des statuts › avance une tache %s vers %s | Unitaire | 2 |
| `services/api/src/services/gestion.service.spec.ts` | cycles des statuts › refuse de sauter ou reculer %s vers %s | Unitaire | 3 |

## Espace client

61 tests.

| Fichier | Test | Niveau | Cas |
| --- | --- | --- | ---: |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Accueil et navigation du client › conserve quatre rubriques, un titre et la rubrique active sur %s | Unitaire | 4 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Accueil et navigation du client › renvoie %s vers son espace | Unitaire | 2 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Accueil et navigation du client › protege une rubrique et conserve la destination du visiteur | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Accueil et navigation du client › redirige les anciens liens de devis en conservant leurs parametres | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Accueil et navigation du client › affiche le widget et les etapes des seules demandes renvoyees par le serveur | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Accueil et navigation du client › presente le cas sans fiche ni demande avec un lien pour demander un devis | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Accueil et navigation du client › annonce le chargement puis une erreur de l accueil | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Avis et publication dans Mes evenements › affiche les evenements, l accord et les etiquettes du formulaire d avis | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Avis et publication dans Mes evenements › n affiche aucun formulaire d avis pour un evenement non termine ou deja evalue | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Avis et publication dans Mes evenements › valide l avis avant l envoi puis affiche son statut de moderation | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Avis et publication dans Mes evenements › garde le commentaire apres un refus du serveur | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Avis et publication dans Mes evenements › evite le double envoi d un avis | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Avis et publication dans Mes evenements › donne puis retire l accord et retablit le controle en cas d erreur | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Avis et publication dans Mes evenements › presente le cas vide et une erreur de chargement | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › efface le message de mot de passe quand l e-mail change et revient a sa valeur initiale | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › separe compte et fiche et masque la fiche si elle est absente | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › valide le compte et ne demande le mot de passe que pour un nouvel e-mail | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › transmet un bloc fiche complet et affiche les erreurs du serveur | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › affiche l e-mail du contact en lecture seule, gere par Innov Events | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › exige mot de passe et confirmation avant la suppression | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › efface l etat de connexion apres succes puis revient a l accueil avec le message | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › conserve compte, session et formulaire sur le 503 d effacement indisponible | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › affiche une erreur si le profil ne se charge pas | Unitaire | 1 |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | Profil et effacement du compte › annonce la suppression sur la page d accueil publique | Unitaire | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › presente les 3 prochains evenements et le suivi des demandes rattachees seulement | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › renvoie des listes vides pour un compte sans fiche client | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › refuse en 404 l evenement d un autre client | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › modifie le profil avec les controles de saisie, de doublon et de mot de passe | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › refuse la modification de coordonnees pour un compte sans fiche | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › refuse au client la modification de l e-mail du contact de sa fiche | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › refuse la modification du profil si le mot de passe est remplace avant l ecriture | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › refuse une sauvegarde partie avant un changement d e-mail confirme | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › suspend la conversion si deux fiches partagent l adresse de la demande | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › garde la demande de Beta hors de l espace d Alpha, meme si Alpha vise son adresse | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › ne donne rien de la fiche rattachee apres l ouverture de la session : %s %s | Intégration | 8 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › accepte un seul avis, seulement sur un evenement termine, en attente de moderation | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › espace client › donne puis retire l accord de publication en conservant la premiere date | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › efface le compte, anonymise la fiche, detruit les sessions et retire le nom des journaux | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › supprime un compte sans fiche sans effacer les demandes d une autre entreprise | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › garde les demandes d une autre entreprise quand l administratrice supprime un compte sans fiche | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › conserve la demande commune quand Alpha est supprimee par %s, sans la rattacher a Beta sans confirmation | Intégration | 2 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › refuse la suppression d un compte rattache a une fiche pendant la suppression | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › refuse l effacement si le mot de passe est remplace avant l ecriture | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › consigne un echec MongoDB sans donnee personnelle puis la purge rejoue le retrait | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › refuse l effacement sans rien supprimer si MongoDB est entierement indisponible, puis l accepte au retablissement | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › retire le journal d effacement si la transaction echoue, sans rien supprimer | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › ne reprend dans la purge que les journaux d effacement d une fiche anonymisee | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › supprime un compte sans fiche meme si MongoDB est indisponible | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › effacement demande par le client › laisse inchange le parcours de l administratrice : le nom reste dans son journal | Intégration | 1 |

## Journaux et purges des données

8 tests.

| Fichier | Test | Niveau | Cas |
| --- | --- | --- | ---: |
| `services/api/src/repositories/logs.repository.spec.ts` | Expiration des journaux de connexion › cree un index TTL partiel de 180 jours limite aux connexions | Unitaire | 1 |
| `services/api/src/repositories/logs.repository.spec.ts` | Expiration des journaux de connexion › couvre exactement les types ecrits par le service de journalisation | Unitaire | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › purges automatiques › supprime les demandes echouees de plus de 3 ans et conserve les autres | Intégration | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › purges automatiques › supprime les journaux de plus d un an hors connexions, sans arreter les autres etapes | Intégration | 1 |
| `services/api/src/routes/j7.integration.spec.ts` | J7 avec PostgreSQL reel › journaux : structure identique, BSON Date, IP validee et aucun mot de passe | Intégration | 1 |
| `services/api/src/services/purges.service.spec.ts` | Purges automatiques › enchaine les trois etapes et consigne un bilan sans donnee personnelle | Unitaire | 1 |
| `services/api/src/services/purges.service.spec.ts` | Purges automatiques › poursuit apres l echec d une etape et ne lance jamais deux passages a la fois | Unitaire | 1 |
| `services/api/src/services/purges.service.spec.ts` | Purges automatiques › passe au demarrage puis toutes les 24 heures, jusqu a l arret | Unitaire | 1 |

## Application mobile

62 tests.

| Fichier | Test | Niveau | Cas |
| --- | --- | --- | ---: |
| `apps/mobile/e2e/app.spec.ts` | protege la liste et permet connexion puis deconnexion de l’employe | Bout en bout | 1 |
| `apps/mobile/e2e/app.spec.ts` | recherche et filtre la liste en annoncant le nombre de resultats | Bout en bout | 1 |
| `apps/mobile/e2e/app.spec.ts` | liste, fiche, client, liens de contact, note puis CGU depuis la connexion | Bout en bout | 1 |
| `apps/mobile/src/app/app.component.spec.ts` | AppComponent › should create the app | Unitaire | 1 |
| `apps/mobile/src/app/client/client.page.spec.ts` | Fiche client mobile › genere les liens d appel, d e-mail et d itineraire Google Maps hors iPhone | Unitaire | 1 |
| `apps/mobile/src/app/client/client.page.spec.ts` | Fiche client mobile › ouvre Plans sur iPhone | Unitaire | 1 |
| `apps/mobile/src/app/client/client.page.spec.ts` | Fiche client mobile › masque une action dont la coordonnee manque et l annonce | Unitaire | 1 |
| `apps/mobile/src/app/client/client.page.spec.ts` | Fiche client mobile › masque toutes les actions d une fiche anonymisee | Unitaire | 1 |
| `apps/mobile/src/app/client/client.page.spec.ts` | Fiche client mobile › revient a l evenement d origine, sinon a la liste | Unitaire | 1 |
| `apps/mobile/src/app/client/client.page.spec.ts` | Fiche client mobile › affiche l erreur du serveur | Unitaire | 1 |
| `apps/mobile/src/app/connexion/connexion.page.spec.ts` | Connexion mobile › refuse l’espace employe au compte client | Unitaire | 1 |
| `apps/mobile/src/app/connexion/connexion.page.spec.ts` | Connexion mobile › ne demande que le nouveau mot de passe dans la session restreinte | Unitaire | 1 |
| `apps/mobile/src/app/connexion/connexion.page.spec.ts` | Connexion mobile › demande l’e-mail pour le mot de passe oublie | Unitaire | 1 |
| `apps/mobile/src/app/connexion/connexion.page.spec.ts` | Connexion mobile › propose les CGU et les CGV depuis la connexion | Unitaire | 1 |
| `apps/mobile/src/app/core/api.service.spec.ts` | Appels API et destination de connexion › joint le jeton de la session courante en %s | Unitaire | 3 |
| `apps/mobile/src/app/core/api.service.spec.ts` | Appels API et destination de connexion › redemande un jeton apres chaque changement de session | Unitaire | 1 |
| `apps/mobile/src/app/core/api.service.spec.ts` | Appels API et destination de connexion › refuse une destination non autorisee : %s | Unitaire | 6 |
| `apps/mobile/src/app/core/api.service.spec.ts` | Appels API et destination de connexion › conserve le chemin interne, ses parametres et son ancre | Unitaire | 1 |
| `apps/mobile/src/app/core/authentification.guard.spec.ts` | Protection de l’espace mobile › controle %s restreinte=%s | Unitaire | 5 |
| `apps/mobile/src/app/core/contact.spec.ts` | Liens de contact › nettoie le numero %s | Unitaire | 6 |
| `apps/mobile/src/app/core/contact.spec.ts` | Liens de contact › construit le lien d e-mail seulement pour une adresse | Unitaire | 1 |
| `apps/mobile/src/app/core/contact.spec.ts` | Liens de contact › encode l adresse de l itineraire | Unitaire | 1 |
| `apps/mobile/src/app/core/statuts.spec.ts` | Statuts mobiles › reprend exactement la table des familles de la charte | Unitaire | 1 |
| `apps/mobile/src/app/core/statuts.spec.ts` | Statuts mobiles › affiche un statut inconnu tel quel, en neutre | Unitaire | 1 |
| `apps/mobile/src/app/evenement/evenement.page.spec.ts` | Fiche evenement mobile › affiche nom, dates, lieu, statut, client et notes de l evenement | Unitaire | 1 |
| `apps/mobile/src/app/evenement/evenement.page.spec.ts` | Fiche evenement mobile › place le bouton Ajouter une note en haut de la fiche, en bouton principal pleine largeur | Unitaire | 1 |
| `apps/mobile/src/app/evenement/evenement.page.spec.ts` | Fiche evenement mobile › enregistre une note, confirme et l affiche dans la liste | Unitaire | 1 |
| `apps/mobile/src/app/evenement/evenement.page.spec.ts` | Fiche evenement mobile › n envoie la note qu une fois en cas de double appui | Unitaire | 1 |
| `apps/mobile/src/app/evenement/evenement.page.spec.ts` | Fiche evenement mobile › refuse une note vide et affiche l erreur du serveur sans perdre le texte | Unitaire | 1 |
| `apps/mobile/src/app/evenement/evenement.page.spec.ts` | Fiche evenement mobile › ferme la saisie sans envoyer avec Annuler | Unitaire | 1 |
| `apps/mobile/src/app/evenement/evenement.page.spec.ts` | Fiche evenement mobile › affiche l erreur de chargement et refuse un identifiant invalide sans appel | Unitaire | 1 |
| `apps/mobile/src/app/evenement/evenement.page.spec.ts` | Fiche evenement mobile › signale un client anonymise sans lien vers sa fiche | Unitaire | 1 |
| `apps/mobile/src/app/home/home.page.spec.ts` | Evenements mobiles › charge les evenements a venir a chaque ouverture Ionic | Unitaire | 1 |
| `apps/mobile/src/app/home/home.page.spec.ts` | Evenements mobiles › vide la liste et affiche une erreur si la session est perdue | Unitaire | 1 |
| `apps/mobile/src/app/home/home.page.spec.ts` | Evenements mobiles › detruit la session a la deconnexion | Unitaire | 1 |
| `apps/mobile/src/app/home/home.page.spec.ts` | Evenements mobiles › affiche des badges d’etat distincts pour Brouillon, Accepte et En cours | Unitaire | 1 |
| `apps/mobile/src/app/home/home.page.spec.ts` | Evenements mobiles › presente Se deconnecter en bouton secondaire, Actualiser en bouton principal | Unitaire | 1 |
| `apps/mobile/src/app/home/home.page.spec.ts` | Evenements mobiles › recherche sur le nom, le client et le lieu sans tenir compte des accents ni de la casse | Unitaire | 1 |
| `apps/mobile/src/app/home/home.page.spec.ts` | Evenements mobiles › filtre par statut, cumule avec la recherche et reinitialise | Unitaire | 1 |
| `apps/mobile/src/app/home/home.page.spec.ts` | Evenements mobiles › ouvre la fiche de chaque evenement et propose les CGU et les CGV | Unitaire | 1 |
| `apps/mobile/src/app/home/home.page.spec.ts` | Evenements mobiles › affiche les dates au format francais | Unitaire | 1 |
| `apps/mobile/src/app/page-legale/page-legale.page.spec.ts` | CGU et CGV mobiles › affiche toutes les sections de la page %s | Unitaire | 2 |
| `apps/mobile/src/app/page-legale/page-legale.page.spec.ts` | CGU et CGV mobiles › relie les CGU aux CGV et inversement | Unitaire | 1 |
| `apps/mobile/src/app/page-legale/page-legale.page.spec.ts` | CGU et CGV mobiles › reprend les titres du site et laisse les pages accessibles sans connexion | Unitaire | 1 |
| `services/api/src/routes/j10.integration.spec.ts` | J10 avec PostgreSQL reel : espace client, catalogue public, purges et matrice d acces › evenements a venir du mobile › garde un evenement commence et pas fini, exclut un evenement fini | Intégration | 1 |
