/**
 * Conditions generales d'utilisation et de vente, recopiees a l'identique du site web :
 * apps/web/src/app/pages/page-legale/contenus-legaux.ts (sections « cgu » et « cgv »).
 * Toute modification du site doit etre reportee ici.
 */
export interface SectionLegale {
  titre: string;
  paragraphes: readonly string[];
}

export interface ContenuLegal {
  titre: string;
  introduction: string;
  sections: readonly SectionLegale[];
}

export type NomPageLegale = 'cgu' | 'cgv';

/** Version publiee sur le site. */
export const VERSION_LEGALE = 'Version du 13 novembre 2026';

export const PAGES_LEGALES: Record<NomPageLegale, ContenuLegal> = {
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
};
