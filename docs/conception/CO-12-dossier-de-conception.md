# CO-12 — Dossier de conception — Innov'Events Manager

Ce dossier réunit les livrables de conception, les relie aux besoins et indique, pour chacun, comment la réalisation l'a suivi ou fait évoluer. Les fichiers cités se trouvent dans `docs/conception/`, sauf mention contraire.

## 1. Besoins

Innov'Events, agence d'organisation d'événements professionnels, veut :
- faire connaître ses réalisations et recevoir des demandes de devis depuis un site public ;
- traiter chaque demande jusqu'au devis accepté : qualification, fiche client, événement, prestations, PDF, envoi, réponse du client, contre-proposition ;
- donner à chaque client un espace pour suivre sa demande, répondre à ses devis, évaluer ses événements et gérer ses données ;
- outiller l'équipe : clients, événements, notes partagées, tâches, modération des avis, comptes, journaux ;
- donner aux employés sur le terrain une application mobile : événements à venir, fiches, appel, e-mail, itinéraire, notes.

### Acteurs

| Acteur | Accès |
|---|---|
| Visiteur | Pages publiques, contact, demande de devis, inscription |
| Client | Son espace : suivi de la demande, devis, événements, avis, accord de publication, profil, suppression du compte |
| Employé | Clients et événements en consultation, ses notes, ses tâches, modération des avis ; application mobile |
| Administratrice | Tout ce que fait l'employé, plus la gestion : prospects, devis, clients, événements, notes globales, tâches, comptes, journaux, paramètres. Compte créé uniquement par script |

### Exigences

Une issue GitHub par exigence, identifiant en tête de titre (98 au total), suivie dans le tableau Kanban. Domaines fonctionnels : site public (PUB-01 à PUB-09), authentification (AUTH-01 à AUTH-06), parcours devis (DEV-01 à DEV-10), espace client (CLI-01 à CLI-07), espace employé (EMP-01 à EMP-05), administration (ADM-01 à ADM-09), journaux (LOG-01 à LOG-03), mobile (MOB-01 à MOB-07). S'y ajoutent les exigences transverses (accessibilité, responsive, sécurité, RGPD, code, éco-conception, erreurs), de tests et de déploiement.

## 2. Règles métier retenues

Le sujet laisse certains points ouverts. Les règles retenues, appliquées par l'API et testées :

| Domaine | Règle |
|---|---|
| Statuts ajoutés | « Converti » pour une demande et « en préparation » pour un devis, nécessaires au parcours |
| Objets distincts | La demande (prospect), la fiche client (créée à la conversion) et le compte utilisateur sont trois objets : la fiche porte le contact commercial de l'entreprise, le compte l'identité de la personne qui se connecte |
| Rôles | Une seule administratrice ; l'employé dispose d'un compte suffisant pour l'application mobile |
| TVA | Taux par défaut (20 %) dans les paramètres, copié dans le devis à sa création ; HT, TVA et TTC calculés à partir des lignes, jamais stockés |
| Événement | Un type obligatoire et un thème facultatif ; statut choisi à la création (« brouillon » ou « accepté ») ; quand un devis est accepté, un événement en brouillon passe automatiquement à « accepté » (un événement déjà en cours garde son statut) ; un événement terminé ne peut pas être annulé |
| Devis | Plusieurs formules par événement, une seule acceptée ; au moins une prestation avant l'envoi ; à l'acceptation, les autres devis ouverts passent à « refusé » ; une demande de modification met à jour le devis (dernier motif conservé) ; pour un événement annulé ou terminé, envoi, acceptation et modification refusés, le refus reste possible ; PDF générés à la demande |
| Publication | Un événement est visible sur la page publique si le client a donné son accord, si l'administratrice a coché « visible » et s'il n'est pas en brouillon ; un événement annulé reste publiable, avec son statut affiché ; jamais de prix |
| Notes et tâches | L'employé gère ses notes d'événement ; seule l'administratrice crée des notes globales et gère toutes les notes ; les tâches sont créées et assignées par l'administratrice, seul l'affecté change leur statut ; une tâche terminée ne se rouvre pas |
| Avis | Un avis par événement terminé, par le client organisateur, note de 1 à 5 ; publié après validation, sans nom |
| Comptes | À l'envoi du premier devis, compte client créé avec un mot de passe temporaire ; si un compte client existe déjà à l'adresse de contact sans fiche, il est rattaché à la fiche, son mot de passe est remplacé par un temporaire et ses sessions sont fermées (adresse d'inscription jamais vérifiée) ; une fiche déjà rattachée garde son compte ; mot de passe temporaire (oubli, compte créé) stocké à part, à usage unique, limité dans le temps (environ 1 heure pour un oubli, 7 jours sinon), changement imposé ; compte d'employé ou de client créé par l'administratrice avec un mot de passe temporaire envoyé par e-mail ; compte suspendu : connexion refusée, sessions détruites |
| Adresses non vérifiées | L'e-mail de contact de la fiche n'est pas modifiable par le client ; une demande n'est rattachée à une fiche existante qu'après confirmation par l'administratrice ; l'e-mail de connexion ne désigne aucune demande |
| Suppression | Effacement demandé par un client rattaché à une fiche : journal d'effacement écrit avant la transaction (s'il ne peut pas l'être, l'effacement est refusé sans rien modifier) ; compte supprimé, fiche anonymisée, notes de ses événements supprimées ; demandes rattachées à la fiche supprimées, ainsi que les demandes non converties portant l'adresse de contact de la fiche si aucune autre fiche active ne partage cette adresse ; devis, événements et avis conservés (avis sans nom), nom retiré des journaux. Effacement d'un compte sans fiche : seul le compte est supprimé, aucune demande n'est effacée, l'effacement est journalisé ensuite ; suppression d'un employé : logique, tâches en cours réaffectées à l'administratrice ; un événement qui a un devis s'annule, il ne se supprime pas |
| Données personnelles | Journaux de connexion (avec IP) effacés après 6 mois, autres journaux après 1 an, demandes classées sans suite 3 ans après le dernier contact |
| Client actif | Client qui a au moins un événement en cours (tableau de bord) |
| Adresse postale | Obligatoire à la conversion (itinéraire mobile) |
| Image d'événement | Adresse `https` saisie par l'administratrice |

## 3. Livrables de conception

| Livrable | Fichiers | Contenu | Exigences |
|---|---|---|---|
| Cas d'utilisation | `CO-01-cas-utilisation.pdf` (source `.drawio.xml`) | Quatre acteurs, fonctionnalités web et mobile | CO-01 |
| Cycles de statuts | `CO-02-cycles-status.pdf` | Demande, devis, événement, tâche, avis, compte | CO-02 |
| Modèle conceptuel | `CO-03-MCD.pdf` | Entités, associations, cardinalités | CO-03 |
| Modèle logique et script | `CO-04-MLD.pdf`, `database/CO-04-script-postgresql.sql`, `database/CO-04-tests-contraintes.sql` | Tables, clés, contraintes, index, rôle applicatif, fonctions de suppression ; 61 tests des contraintes | CO-04 |
| Jeu d'essai | `database/CO-05-jeu-essai.sql`, `docs/tests/CO-05-resultats.md` | Toutes les tables, chaque rôle et chaque statut, cas limites | CO-05 |
| Architecture | `CO-06-architecture.drawio.xml`, `CO-06-couches-securite.md` | Vues locale et production, couches et sécurité | CO-06 |
| Wireframes et enchaînement | `CO-07-wireframes.drawio.xml`, `CO-08-enchainement.drawio.xml`, `CO-07-CO-08-parcours.md`, `visuels/CO-07-*.png` | Trois écrans web (W1 demande de devis, W2 préparation et envoi du devis, W3 devis du client) et trois écrans mobiles (M1 événements, M2 fiche et note, M3 fiche client) ; enchaînement | CO-07, CO-08 |
| Charte graphique | `CO-09-charte.md`, `CO-09-charte-complete.pdf` | Palette, typographie, espacements, composants, contrastes, focus ; paires wireframe / maquette | CO-09 |
| Maquettes | `CO-10-maquettes.pdf`, `CO-10-presentation.md`, `visuels/CO-10-*` | Les six écrans à la charte | CO-10 |
| Séquence de connexion | `CO-11-sequence-connexion.drawio.xml` | Connexion, contrôle du rôle, journal, mot de passe temporaire | CO-11 |

## 4. De la conception à la réalisation

| Livrable | Évolution pendant la réalisation |
|---|---|
| Cycles de statuts | Le statut d'un événement peut être choisi « accepté » dès sa création (accord obtenu hors plateforme) ; une validation manuelle ne change pas les devis en cours. Les devis d'un événement annulé ou terminé ne peuvent plus être envoyés ni acceptés |
| Modèle logique | La contrainte sur la date d'envoi d'un devis admet le statut « refusé » : un brouillon jamais envoyé passe à « refusé » quand une autre formule est acceptée. Script, tests (61), source du MLD et `CO-04-MLD.pdf` mis à jour ; migration `database/migrations/2026-11-15-ck-devis-envoi.sql` |
| Wireframes et enchaînement | L'écran W2 est réparti entre deux rubriques de l'administration : « Prospects » (qualification, conversion) puis « Devis » (événement prérempli, formules, prestations, PDF, envoi, contre-proposition) ; l'enchaînement est conservé : après la conversion, la rubrique Devis s'ouvre sur l'événement prérempli |
| Organisation des espaces | Non couverte par les six wireframes, fixée pendant la réalisation : un menu par rôle et une page par rubrique (section 5) ; sur grand écran, les rubriques de l'équipe restent visibles en haut de page ; sur petit écran, elles sont regroupées en tête du menu repliable de l'en-tête |
| Charte | Appliquée aux espaces de l'équipe ; badges de statut issus d'une table unique, identiques sur le web et le mobile ; couleur de bordure discrète des cartes et tableaux ajoutée à la palette (`CO-09-charte.md` et `CO-09-charte-complete.pdf`) |
| Mobile | Application web Ionic servie par nginx, ouverte dans le navigateur du téléphone ; essayée sur iPhone |

## 5. Organisation des espaces

| Espace | Rubriques |
|---|---|
| Administratrice (`/administration`) | Tableau de bord (chiffres clés, notes récentes, notes globales) · Prospects · Clients · Événements (notes et tâches dans la fiche) · Devis (dont devis acceptés) · Tâches · Avis · Comptes · Journaux · Paramètres (message de remerciement) |
| Employé (`/administration`) | Clients · Événements (notes et tâches) · Mes tâches · Avis ; les rubriques réservées à l'administratrice n'apparaissent pas et restent refusées par l'API |
| Client (`/espace`) | Accueil (3 prochains événements, suivi de la demande) · Mes devis · Mes événements (avis, accord de publication) · Mon profil (modification, suppression du compte) |
| Mobile | Événements à venir → fiche événement (ajout de note) → fiche client (appel, e-mail, itinéraire) ; CGU et CGV |

Après la connexion, chaque rôle arrive sur son espace : tableau de bord pour l'administratrice, rubrique Événements pour l'employé, accueil de l'espace client pour le client.

## 6. Traçabilité

| Domaine | Exigences | Conception | Réalisation et preuves |
|---|---|---|---|
| Site public | PUB-01 à PUB-09 | W1, charte, maquettes | `apps/web` (pages publiques) ; `docs/tests/PUB-01-PUB-04-TR-04-resultats.md`, `docs/tests/J10-web-resultats.md` |
| Authentification | AUTH-01 à AUTH-06 | Séquence de connexion, cycle des comptes | `docs/authentification-et-formulaires.md` ; tests `j7.integration.spec.ts` |
| Parcours devis | DEV-01 à DEV-10, CLI-01 | W2, W3, cycles des demandes et devis, MLD | Rubriques Prospects et Devis ; tests `j8.integration.spec.ts` ; `docs/tests/TST-02-demande-devis.md` |
| Espace client | CLI-02 à CLI-07 | W3, organisation des espaces | `/espace` ; `docs/tests/J10-api-resultats.md`, `docs/tests/J10-web-resultats.md` |
| Équipe | EMP-01 à EMP-05, ADM-01 à ADM-09 | Organisation des espaces, cycles des tâches et avis | `/administration` ; `docs/tests/J9-*.md` |
| Journaux | LOG-01 à LOG-03 | Architecture, MCD (collection `logs`) | `docs/technique/03-bases-de-donnees.md` |
| Mobile | MOB-01 à MOB-07 | M1, M2, M3 | `apps/mobile` ; `docs/tests/J9-mobile-resultats.md`, `docs/tests/J10-mobile-resultats.md` |
| Transverses | Accessibilité, responsive, sécurité, RGPD, code, éco-conception, erreurs | Charte, architecture | `docs/technique/` ; plan de tests §5 et §8 |

L'inventaire des 481 cas automatisés (fichier, nom du test, niveau, nombre de cas), regroupés par fonctionnalité, est dans `docs/tests/tableau-des-tests.md`. Le rapprochement entre domaines d'exigences et niveaux de test est au §2 de `docs/tests/plan-de-tests.md` ; le §8 du même plan indique les exigences couvertes par chaque scénario de recette.
