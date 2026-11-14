import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Accueil | Innov’Events',
    loadComponent: () => import('./pages/accueil/accueil').then((m) => m.Accueil),
  },
  ...[
    { path: 'mentions-legales', titre: 'Mentions légales', page: 'mentions' },
    { path: 'cgu', titre: 'Conditions générales d’utilisation', page: 'cgu' },
    { path: 'cgv', titre: 'Conditions générales de vente', page: 'cgv' },
    { path: 'confidentialite', titre: 'Politique de confidentialité', page: 'confidentialite' },
  ].map(({ path, titre, page }) => ({
    path,
    title: `${titre} | Innov’Events`,
    data: { page },
    loadComponent: () => import('./pages/page-legale/page-legale').then((m) => m.PageLegale),
  })),
  ...[
    {
      path: 'evenements',
      titre: 'Événements',
      description: 'Le catalogue des événements sera disponible prochainement.',
    },
    {
      path: 'avis',
      titre: 'Avis',
      description: 'Les avis validés seront disponibles prochainement.',
    },
    {
      path: 'contact',
      titre: 'Contact',
      description: 'Le formulaire de contact sera disponible prochainement.',
    },
    {
      path: 'connexion',
      titre: 'Connexion',
      description: 'La connexion à votre espace sera disponible prochainement.',
    },
    {
      path: 'demande-devis',
      titre: 'Demander un devis',
      description:
        'Le formulaire de demande de devis sera disponible prochainement. Aucune demande ne peut être envoyée depuis cette version.',
    },
  ].map(({ path, titre, description }) => ({
    path,
    title: `${titre} | Innov’Events`,
    data: { titre, description },
    loadComponent: () => import('./pages/page-attente/page-attente').then((m) => m.PageAttente),
  })),
  {
    path: '**',
    title: 'Page introuvable | Innov’Events',
    loadComponent: () =>
      import('./pages/page-introuvable/page-introuvable').then((m) => m.PageIntrouvable),
  },
];
