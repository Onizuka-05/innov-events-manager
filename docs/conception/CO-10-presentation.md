# CO-10 - Maquettes des interfaces

Projet : Innov’Events Manager. Version : 13/11/2026.

Six maquettes statiques : trois web et trois mobile. Les noms et l’ordre reprennent les wireframes CO-07. La charte CO-09 détermine les couleurs, la typographie, les espacements et les composants.

| Code | Support | Écran | État représenté |
|---|---|---|---|
| W1 | Web | Demande de devis | Dix champs renseignés avec des données fictives ; focus illustratif sur Entreprise. |
| W2 | Web | Préparer et envoyer un devis | Composition des étapes successives de qualification, conversion, événement et devis. L’activation des étapes dépend de la validation des précédentes. |
| W3 | Web | Mes devis | Proposition sélectionnée ; formulaire de modification ouvert ; focus illustratif sur la demande de modification. |
| M1 | Mobile | Événements à venir | Liste réservée à l’équipe, triée par date. |
| M2 | Mobile | Fiche événement et note | Fiche et formulaire ouvert après activation d’Ajouter une note. |
| M3 | Mobile | Fiche client et contact | Coordonnées fictives ; appel, e-mail et itinéraire. |

## Fichiers

- CO-10-maquettes.drawio.xml : six pages modifiables, avec textes et formes natifs.
- CO-10-maquettes.pdf : une page par écran ; format adapté à la hauteur des captures complètes.
- visuels/CO-10-*.png : exports à deux fois les dimensions de conception.
- visuels/CO-10-*.svg : exports vectoriels.
- CO-09-charte.md et CO-09-charte-complete.pdf : charte complétée avec les six paires wireframe/maquette au §9.
- visuels/CO-07-*.png : exports des six wireframes CO-07, placés en regard des maquettes au §9 de la charte.

## Choix de présentation

Les maquettes web utilisent une largeur de conception de 1440 px et un contenu limité à 1200 px. Les écrans mobile utilisent 390 px de largeur. W2 est une page longue : ses groupes sont disposés verticalement pour conserver une lecture claire des formulaires. Le PDF et les PNG montrent la totalité de ces pages, y compris le contenu sous la première hauteur de fenêtre.

Les textes courants utilisent 16 px, les détails au moins 14 px ; les boutons principaux mesurent au moins 44 px de haut. Les statuts combinent un libellé et le couple de couleurs prévu par CO-09. Le focus violet est illustré sur une surface claire. La typographie reste une police système sans téléchargement ; la source draw.io utilise Segoe UI avec le remplacement disponible sur le poste de consultation.

Tous les noms, numéros, adresses et montants sont des exemples de conception. Les informations structurelles des fiches mobile sont en lecture seule. Les données de contact ne sont visibles qu’aux profils autorisés.

## Vérifications et limites

Contrôles de conception : six pages, identifiants uniques, éléments dans les limites des pages, cohérence des totaux HT/TVA/TTC et emploi des couleurs de la charte. Aucun ajout de ressource graphique externe, de police téléchargée ni de bibliothèque dans l’application.

Ces maquettes ne prouvent pas le fonctionnement de l’application ni sa conformité RGAA. Les droits, les transitions, le CSRF, les confirmations d’acceptation/refus, le clavier, le lecteur d’écran, le zoom, le reflow à 320 px et les états Ionic doivent être vérifiés dans l’implémentation.
