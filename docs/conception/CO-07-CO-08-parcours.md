# CO-07 et CO-08 — Wireframes et enchaînement des écrans

**Projet :** Innov'Events Manager  
**Version :** 13/11/2026  
**Nature :** conception des interfaces et de leur navigation  
**Sources modifiables :** `CO-07-wireframes.drawio.xml` (six pages), `CO-08-enchainement.drawio.xml` (une page)

## 1. Périmètre

Le parcours web couvre la demande de devis, la qualification et la conversion du prospect, la création des formules, le PDF, l'envoi et la réponse du client. Le parcours mobile couvre la consultation des événements, le contact client, l'itinéraire et les notes rapides. Il comprend l'accès aux CGU et CGV.

Les trois wireframes web représentent le parcours commercial. Les trois wireframes mobile prolongent ce parcours par le suivi de l'événement sur le terrain, par l'employé ou l'administratrice. Il s'agit d'une continuité métier entre acteurs ; le client n'est pas redirigé vers l'espace de l'équipe.

Les wireframes restent en niveaux de gris. La charte `CO-09-charte.md` s'applique aux six mockups CO-10 et aux interfaces finales.

## 2. Inventaire des six écrans CO-07

| Page | Profil / support | Écran et objectif | Exigences reliées |
|---|---|---|---|
| **W1** | Visiteur, web | Demande de devis, champs obligatoires, envoi et confirmation | PUB-06 |
| **W2** | Administratrice, web | Qualification, conversion avec adresse postale, événement, prestations HT, TVA/TTC, PDF, envoi et contre-proposition | DEV-01 à DEV-09, ADM-03 |
| **W3** | Client, web | Ses devis, détail et PDF ; accepter, demander une modification motivée ou refuser | CLI-01, CLI-02 |
| **M1** | Employé ou administratrice, PWA | Événements à venir triés par date ; ouverture d'une fiche | MOB-01, MOB-05 |
| **M2** | Employé ou administratrice, PWA | Fiche événement, accès au client, ajout et enregistrement d'une note | MOB-02, MOB-04 |
| **M3** | Employé ou administratrice, PWA | Fiche client ; appel, e-mail et itinéraire | MOB-03 |

W2 représente des étapes successives. La création du devis et son envoi sont bloqués tant que la conversion et l'événement associé ne sont pas validés. Les coordonnées du prospect sont reprises ; **l'adresse postale complète du client est obligatoire à la conversion**, notamment pour l'itinéraire mobile. Elle est distincte du lieu de l'événement.

Les exemples sont fictifs : `client@example.org`, « Société Aster », `00 00 00 00 00`, « Ville fictive ».

## 3. Enchaînement CO-08

1. **W1 — Visiteur :** soumet une demande complète. L'API crée un prospect « à contacter », affiche le texte de remerciement administrable et notifie Innov'Events par e-mail.
2. **W2, étape 1 — Administratrice authentifiée :** qualifie le prospect. Une demande irréalisable passe à « échoué », avec e-mail au prospect. Une demande réalisable est convertie en fiche client, après saisie de l'adresse postale, puis associée à un événement.
3. **W2, étapes 2 et 3 — Administratrice :** choisit le statut initial « Brouillon » ou « Accepté », renseigne l'événement et prépare une ou plusieurs formules de devis. Chaque formule contient des prestations HT ; HT, TVA et TTC sont calculés. Le PDF est généré à la demande et n'est pas stocké. L'envoi fait passer le devis en « étude côté client ».
4. **Connexion web du client :** le compte existant est réutilisé ou un compte est créé à l'envoi du premier devis. Un compte nouvellement créé reçoit un mot de passe provisoire. Après sa première utilisation, une session restreinte impose le choix d'un nouveau mot de passe avant l'accès à W3. Le client disposant déjà de son mot de passe habituel rejoint directement W3 après connexion. Une action demandée avant connexion est reprise après les étapes obligatoires.
5. **W3 — Client :** accède à ses seuls devis et à leur PDF. Il accepte, refuse ou demande une modification avec motif obligatoire. La modification conduit à une contre-proposition préparée en W2 puis renvoyée au client. L'acceptation notifie Innov'Events, passe l'événement à « Accepté » et refuse les autres devis ouverts du même événement. Un seul devis peut être accepté par événement.
6. **Connexion mobile de l'équipe :** l'employé ou l'administratrice se connecte sur la PWA avant M1. Un événement peut avoir été accepté par un devis ou validé manuellement par l'administratrice ; la liste reste triée par date de début.
7. **M1 → M2 → M3 :** ouvrir un événement, consulter son client, puis lancer un appel, un e-mail ou un itinéraire. Depuis M2, « Ajouter une note » ouvre la saisie dans la fiche ; après enregistrement, la note est visible dans cette fiche.

Les retours M3 → M2 → M1 sont disponibles. La fermeture du formulaire de note ramène à M2. W3 reste accessible par « Mes devis ». Les boîtes de connexion, de changement obligatoire, de confirmation et de qualification du schéma sont des étapes fonctionnelles ; elles n'ajoutent pas de wireframes aux six écrans.

Le mot de passe provisoire est stocké séparément du mot de passe habituel. Il expire après environ une heure pour un oubli, ou sept jours pour un compte créé à l'envoi d'un devis. Il est invalidé atomiquement à la première utilisation ; son hachage conservé temporairement ne permet aucune nouvelle connexion et est effacé lors du choix du nouveau mot de passe. Un mot de passe expiré impose une nouvelle demande de mot de passe oublié. CO-11 détaille ce parcours.

## 4. États alternatifs et droits

- **W1 :** neuf rubriques du sujet correspondent à dix champs, le nom et le prénom étant séparés. Tous sont obligatoires ; les erreurs sont associées aux champs, la saisie est conservée en cas d'erreur et la confirmation suit la réussite.
- **W2 :** qualification avec issue réalisable ou échouée ; adresse postale obligatoire à la conversion ; données modifiables ; au moins une prestation avant l'envoi ; plusieurs formules possibles et une seule acceptée. Un brouillon n'est pas publié : la publication exige l'accord horodaté du client et le choix « visible » de l'administratrice.
- **W3 :** motif obligatoire pour une modification ; confirmation explicite avant acceptation ou refus ; actions limitées au statut courant ; aucune action sur un devis finalisé.
- **Connexion avec mot de passe provisoire :** seul le choix du nouveau mot de passe est permis dans la session restreinte, avec les accès techniques nécessaires au CSRF et à la déconnexion. L'API empêche l'accès aux devis et aux autres données avant ce changement.
- **M1 à M3 :** authentification employé ou administratrice obligatoire ; informations structurelles en lecture seule ; aucune donnée de contact publique.
- **M2 :** l'employé ajoute, modifie et supprime ses propres notes liées à l'événement ; l'administratrice gère toutes les notes. Erreur explicite en cas d'échec et confirmation après enregistrement.
- **M3 :** appel par `tel:`, e-mail par `mailto:` et itinéraire par lien cartographique. Une coordonnée absente, notamment après anonymisation, désactive l'action avec explication.

## 5. Accessibilité et règles d'interface

- Libellés persistants, champs obligatoires identifiés, erreurs textuelles associées et non transmises par la couleur seule.
- En-tête, navigation, contenu principal, titres hiérarchisés et pied de page ; lien d'évitement ; ordre de tabulation logique et absence de piège clavier.
- Focus visible selon CO-09 ; cibles mobiles d'au moins 44 × 44 px ; textes adaptés aux petits écrans.
- Palette, états, typographie et contrastes de CO-09 à reprendre dans les six mockups CO-10.
- CGU/CGV accessibles dans la PWA ; mentions légales, CGU, CGV et confidentialité accessibles depuis le web.

Les wireframes sont non interactifs. La conformité et le comportement sont à vérifier sur les mockups CO-10 puis sur l'implémentation.
