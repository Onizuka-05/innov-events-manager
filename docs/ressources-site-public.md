# Ressources du site public

Version du 13/11/2026 — PUB-01 à PUB-04 et volet documentaire TR-04.

## Images, police et dépendances

| Ressource | Emplacement | Origine et droits | Usage |
|---|---|---|---|
| Rencontre professionnelle | `apps/web/public/images/rencontre.svg` | Composition vectorielle propre au projet, formes géométriques ; aucune photo, police ou illustration tierce incorporée | Accueil, alternative textuelle dans le HTML |
| Réception | `apps/web/public/images/reception.svg` | Composition vectorielle propre au projet, formes géométriques ; aucune ressource tierce incorporée | Accueil, chargement différé |
| Favicon | `apps/web/public/favicon.svg` | Formes géométriques propres au projet | Icône du site |
| Police système | `apps/web/src/styles.css` | Police fournie par le système de l’utilisateur, sans fichier téléchargé ni redistribué | Toutes les pages |

Aucune nouvelle dépendance npm et aucun asset tiers dans ce lot : aucune entrée nouvelle à ajouter à `THIRD_PARTY_NOTICES` au titre de ces trois SVG. Les notices déjà dues aux dépendances du socle restent à conserver et à compléter dans le lot documentaire correspondant. Les illustrations ne prétendent représenter aucun client ni événement réel. Les fichiers SVG ne contiennent ni script, ni ressource distante, ni métadonnée d’auteur.

## Sources du contenu légal

Consultées le 13/11/2026 ; les textes du site sont rédigés pour une démonstration à données fictives.

- [Render — conditions de service](https://render.com/terms) : raison sociale, adresse et téléphone du contact juridique DMCA (le téléphone n’est pas présenté comme une assistance générale).
- [Render — contact](https://render.com/contact) et [accord de traitement](https://render.com/dpa).
- [Neon — conditions de plateforme](https://neon.com/platform-terms).
- [MongoDB — confidentialité](https://www.mongodb.com/legal/privacy/privacy-policy).
- [Brevo — confidentialité](https://www.brevo.com/legal/privacypolicy/).
- [CNIL — information et transparence](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence).
- [CNIL — droits](https://www.cnil.fr/fr/comprendre-vos-droits).

Les politiques des fournisseurs ne constituent pas la preuve des régions, accords, transferts, sauvegardes ou durées effectivement applicables aux comptes du projet. Les régions ont été relevées dans les consoles des services le 13/11 : Render et Neon à Francfort, Atlas chez AWS à Paris ; sauvegardes Atlas désactivées. Les garanties de transfert, copies et traces techniques restent à vérifier pour les comptes utilisés, avant toute collecte réelle. Aucune conformité RGPD de production n’est affirmée.

## Références fonctionnelles

- PUB-01 : menu commun, responsive, navigation clavier ; session et déconnexion à raccorder avec AUTH-02.
- PUB-02 : accueil avec deux images locales et CTA vers `/demande-devis` ; le formulaire PUB-06 reste à réaliser.
- PUB-03 : champs d’identité de l’éditeur renseignés par des données expressément fictives, hébergeur Render identifié.
- PUB-04 : deux pages distinctes CGU et CGV, liens en pied de page. CGV adaptées au parcours simulé, sans ajout d’acompte, de frais ou de délai non décidé.
- TR-04 : page de confidentialité accessible ; durées et effacement cohérents avec les règles retenues ; purges et parcours de droits non livrés par ce lot d’interface.
- Charte CO-09 : palette, police système, contrastes de référence, espacement et focus.

Le contenu de confidentialité reprend les durées du projet : journaux de connexion six mois, autres journaux un an ; prospects échoués trois ans après le dernier contact ; session de huit heures dans la configuration du socle. Le texte précise les limites des purges pendant la veille, la pseudonymisation des journaux après effacement et les durées non encore définies pour les autres données. Il ne crée pas de nouvelle règle de conservation.

La finalité des journaux (sécurité et traçabilité), leur base d’intérêt légitime et leur accès réservé à l’administration sont explicités. Le nom conservé dans les journaux de gestion après une suppression administrative est retiré seulement lors de l’effacement demandé par le client. La pseudonymisation décrit les journaux après ce retrait, pas les journaux qui contiennent encore le nom.
