/** Structure editoriale, sans HTML injecte, partagee par les quatre pages legales. */
export interface SectionLegale {
  titre: string;
  paragraphes: readonly string[];
  points?: readonly string[];
  liens?: readonly { libelle: string; url: string }[];
}

export interface ContenuLegal {
  titre: string;
  introduction: string;
  sections: readonly SectionLegale[];
}

export type NomPageLegale = 'mentions' | 'cgu' | 'cgv' | 'confidentialite';

/** Coordonnees de demonstration : aucune identite d'entreprise reelle n'est revendiquee. */
export const PAGES_LEGALES: Record<NomPageLegale, ContenuLegal> = {
  mentions: {
    titre: 'Mentions légales',
    introduction:
      'Ce site est une démonstration pédagogique. L’entreprise, son adresse, son capital, ses coordonnées et sa directrice de publication ci-dessous sont fictifs. Aucun service commercial ne peut être commandé ici.',
    sections: [
      {
        titre: 'Éditeur du site',
        paragraphes: [
          'Raison sociale : Innov’Events Démonstration. Forme juridique : SARL fictive. Capital social fictif : 10 000 €. Siège fictif : 1 rue de la Démonstration, 00000 Ville fictive, France.',
        ],
        points: [
          'Courriel de démonstration : contact@innov-events.example (non joignable).',
          'Téléphone fictif : 00 00 00 00 00 (non joignable).',
          'Directrice de publication : Chloé, personnage fictif du projet.',
        ],
      },
      {
        titre: 'Hébergement',
        paragraphes: [
          'L’hébergeur retenu pour le déploiement de démonstration est Render, exploité par Render Services, Inc., 525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis.',
          'Téléphone publié dans ses conditions de service : +1 415 319 8186. Ce numéro est celui du contact juridique DMCA ; il ne constitue pas une ligne d’assistance technique. Le support est accessible sur le site de Render.',
        ],
        liens: [
          {
            libelle: 'Conditions de service et coordonnées de Render',
            url: 'https://render.com/terms',
          },
          { libelle: 'Contacter Render', url: 'https://render.com/contact' },
        ],
      },
      {
        titre: 'Contenus et illustrations',
        paragraphes: [
          'Les illustrations de ce site représentent des scènes fictives et ne montrent ni client réel ni événement effectivement organisé. Les textes et images servent exclusivement à présenter cette démonstration.',
          'Les liens vers des sites externes sont identifiés par leur destination. Leurs contenus et conditions peuvent évoluer.',
        ],
      },
    ],
  },
  cgu: {
    titre: 'Conditions générales d’utilisation',
    introduction:
      'Ces conditions décrivent l’utilisation du site de démonstration Innov’Events. Utilisez uniquement des identités et des coordonnées fictives dans les parcours de test.',
    sections: [
      {
        titre: 'Objet et accès au site',
        paragraphes: [
          'Le site présente une agence événementielle fictive et son parcours de suivi des demandes de devis. Les rubriques encore indisponibles sont signalées. Aucun achat ni paiement en ligne n’est proposé.',
          'L’accès aux pages publiques est libre. Les espaces personnels et professionnels nécessiteront une connexion et les droits correspondant au rôle du compte.',
        ],
      },
      {
        titre: 'Utilisation des comptes',
        paragraphes: [
          'Chaque utilisateur protège ses identifiants et accède uniquement aux données autorisées pour son rôle. Il ne doit ni usurper une identité, ni publier un contenu illicite, ni tenter d’accéder aux informations d’un autre compte.',
          'Un compte suspendu ne peut plus se connecter. La suppression des données d’un client suit les règles précisées dans la politique de confidentialité.',
        ],
      },
      {
        titre: 'Événements et avis publics',
        paragraphes: [
          'La publication d’un événement nécessite l’accord du client et sa sélection pour publication par l’administration. Les brouillons ne sont pas publics. Un événement annulé peut rester visible avec son statut affiché.',
          'Seuls les avis validés sont destinés à la page publique. Aucun prix de devis n’est publié dans le catalogue d’événements.',
        ],
      },
      {
        titre: 'Disponibilité et données personnelles',
        paragraphes: [
          'La démonstration peut être temporairement indisponible, notamment après une période d’inactivité de l’hébergement gratuit. N’utilisez pas ce site pour une réservation réelle ou une demande urgente.',
          'La politique de confidentialité décrit les données prévues, les destinataires, les durées retenues et vos droits. Les coordonnées fictives de cette version ne permettent pas de contacter une entreprise réelle.',
        ],
      },
    ],
  },
  cgv: {
    titre: 'Conditions générales de vente',
    introduction:
      'Cette page décrit le parcours commercial simulé d’Innov’Events. Aucune prestation réelle, commande ou obligation de paiement ne résulte de l’utilisation de cette démonstration.',
    sections: [
      {
        titre: 'Demande et proposition',
        paragraphes: [
          'Une demande de devis présente le besoin ; elle ne vaut pas commande. Après étude, l’agence peut préparer un ou plusieurs devis pour un même événement. La demande peut être refusée si le projet ne peut pas être réalisé.',
        ],
      },
      {
        titre: 'Prix et contenu du devis',
        paragraphes: [
          'Chaque devis indique les prestations, leurs montants hors taxes, le taux de TVA appliqué et les totaux HT, TVA et TTC. Le contenu d’une proposition dépend du besoin et des prestations retenues.',
          'Les modalités de paiement, d’acompte éventuel, de validité et d’annulation doivent être précisées dans le devis avant tout engagement réel. Aucun montant, délai ou frais contractuel n’est imposé par cette démonstration.',
        ],
      },
      {
        titre: 'Réponse du client',
        paragraphes: [
          'Dans le parcours simulé, le client connecté peut accepter un devis, demander une modification en indiquant son motif, ou le refuser. Une modification entraîne une nouvelle étude par l’agence.',
          'Un seul devis peut être accepté pour un même événement ; les autres propositions ouvertes sont alors refusées. Le document PDF présente la proposition ; sa génération seule ne vaut pas acceptation.',
        ],
      },
      {
        titre: 'Utilisation commerciale',
        paragraphes: [
          'Ces conditions ne constituent pas les conditions de vente d’une entreprise en activité. L’identité du vendeur, le public visé, les règles de paiement, les annulations et les éventuels droits des consommateurs doivent être définis avant toute exploitation réelle.',
        ],
      },
    ],
  },
  confidentialite: {
    titre: 'Politique de confidentialité',
    introduction:
      'Cette démonstration présente les règles de traitement prévues pour Innov’Events. Les parcours de collecte, d’effacement et les purges sont en cours de réalisation. Utilisez uniquement des données fictives ; les règles ci-dessous ne constituent pas la preuve de leur exécution.',
    sections: [
      {
        titre: 'Responsable et finalités',
        paragraphes: [
          'Le responsable présenté est Innov’Events Démonstration, entreprise fictive identifiée dans les mentions légales. Contact de démonstration : contact@innov-events.example, adresse non joignable. Avant une ouverture à des données réelles, une identité et un point de contact opérationnels devront la remplacer.',
        ],
        points: [
          'Demandes et devis : coordonnées et informations nécessaires à l’étude du projet et à son suivi, au titre des mesures précontractuelles ou du contrat.',
          'Compte et sécurité : identité, coordonnées, mot de passe haché et session ; accès au service et prévention des accès non autorisés, selon le contrat et l’intérêt légitime de sécurité.',
          'Journaux d’activité : connexions (adresse IP et, en cas d’échec, e-mail tenté) et actions de gestion des dossiers, pour la sécurité du service et la traçabilité, au titre de l’intérêt légitime ; consultation réservée à l’administration.',
          'Publication des événements : accord du client, recueilli séparément et retirable ; le refus de publication ne bloque pas la prestation.',
          'Aucune publicité ciblée, revente des données ou décision automatisée de profilage n’est prévue.',
        ],
      },
      {
        titre: 'Données nécessaires et accès',
        paragraphes: [
          'Les formulaires doivent distinguer les champs obligatoires des champs facultatifs. L’absence d’une donnée nécessaire empêche de traiter la demande correspondante. Ne saisissez aucune donnée sensible dans les descriptions libres.',
          'Le client n’accède qu’à ses informations. Les employés et l’administration accèdent aux dossiers utiles à leur mission ; les journaux sont réservés à l’administration. Les événements publiés ne doivent contenir ni coordonnées privées ni prix de devis.',
        ],
      },
      {
        titre: 'Durées de conservation prévues',
        paragraphes: [
          'Les règles de durée et de suppression suivantes sont retenues pour le projet :',
        ],
        points: [
          'Prospects au statut « échoué » : suppression trois ans après le dernier contact.',
          'Journaux de connexion, comprenant l’adresse IP et, en cas d’échec, l’e-mail tenté : six mois ; autres journaux d’activité : un an. Leur suppression automatique ne garantit pas un effacement à la seconde exacte de l’échéance.',
          'Session : cookie technique innov.sid d’une durée maximale de huit heures dans la configuration actuelle ; sessions détruites à la déconnexion, à la suspension ou à la suppression du compte une fois ces parcours raccordés.',
          'Mot de passe temporaire : environ une heure pour un oubli, sept jours pour un compte créé à l’envoi d’un devis ; usage unique et changement obligatoire.',
          'Devis, événements et avis : conservation selon les règles d’effacement ci-dessous. Leur durée finale hors journaux reste à préciser avant toute collecte réelle ; aucune durée légale d’archivage commercial n’est revendiquée dans cette démonstration.',
        ],
      },
      {
        titre: 'Effacement et purges',
        paragraphes: [
          'Le parcours prévu de suppression du compte client efface le compte, anonymise sa fiche, supprime les demandes de devis et les notes de ses événements. Les demandes non converties avec le même e-mail sont aussi effacées. Les devis, événements et avis restent conservés ; les avis sont affichés sans nom.',
          'Les journaux de création et de suppression d’une fiche par l’administration contiennent le nom du client. Si l’effacement est demandé par le client, ce nom est retiré de tous ses journaux ; si l’administration supprime la fiche, il y reste jusqu’à la purge du journal (un an). Après le retrait du nom, l’identifiant restant permet encore un rapprochement : les journaux sont pseudonymisés, et non anonymes, jusqu’à leur purge.',
          'Les prospects échoués doivent être purgés au démarrage de l’application puis quotidiennement. Après une mise en veille du service gratuit, la purge est rattrapée à la reprise d’activité ; elle ne fonctionne pas à heure fixe pendant la veille. Les journaux sont destinés à une suppression automatique selon leur échéance. Ces mécanismes doivent être testés avant de traiter des données réelles.',
        ],
      },
      {
        titre: 'Prestataires et limites de l’hébergement',
        paragraphes: [
          'Render héberge les applications à Francfort ; Neon héberge la base relationnelle à Francfort ; MongoDB Atlas héberge les journaux chez AWS à Paris. Brevo est retenu pour les courriels transactionnels ; son envoi réel reste à vérifier pour cette démonstration. En local, les courriels de test sont interceptés et ne sont pas délivrés par Brevo.',
          'Les applications et les bases sont hébergées dans l’Union européenne. Cette localisation ne suffit pas à exclure tous les transferts ou accès hors Espace économique européen, notamment pour le support ou les obligations légales des prestataires. Leurs accords de traitement, sous-traitants ultérieurs et garanties applicables doivent être vérifiés pour les comptes utilisés avant toute collecte réelle.',
          'Les offres gratuites comportent des quotas et des mises en veille. Les sauvegardes Atlas sont désactivées dans la configuration du projet. Cela ne garantit pas l’absence de toute copie ou trace technique chez le prestataire. La durée de restauration conservée par Neon reste à relever. Une purge dans l’application ne prouve pas l’effacement immédiat des traces techniques conservées par les prestataires.',
        ],
        liens: [
          { libelle: 'Accord de traitement de Render', url: 'https://render.com/dpa' },
          { libelle: 'Conditions de la plateforme Neon', url: 'https://neon.com/platform-terms' },
          {
            libelle: 'Informations de confidentialité de MongoDB',
            url: 'https://www.mongodb.com/legal/privacy/privacy-policy',
          },
          {
            libelle: 'Informations de confidentialité de Brevo',
            url: 'https://www.brevo.com/legal/privacypolicy/',
          },
        ],
      },
      {
        titre: 'Cookies, ressources externes et droits',
        paragraphes: [
          'Le cookie de session est destiné au fonctionnement du service. Le site n’ajoute pas de traceur publicitaire ni de mesure d’audience. Les illustrations de l’accueil sont locales ; une image externe sur un futur événement peut communiquer votre adresse IP à son hébergeur lors du chargement.',
          'Selon la base juridique applicable, vous disposez de droits d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité. Vous pouvez retirer un consentement sans remettre en cause le traitement antérieur. Vous pouvez aussi adresser une réclamation à la CNIL.',
          'Dans cette version de démonstration, contactez la personne qui vous a fourni le lien pour toute question sur un test. Un canal opérationnel d’exercice des droits et les fonctions du compte doivent être disponibles avant tout usage réel.',
        ],
        liens: [
          {
            libelle: 'Comprendre vos droits auprès de la CNIL',
            url: 'https://www.cnil.fr/fr/comprendre-vos-droits',
          },
          { libelle: 'Adresser une plainte à la CNIL', url: 'https://www.cnil.fr/fr/plaintes' },
        ],
      },
    ],
  },
};
