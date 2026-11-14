import { authentificationGuard } from './core/authentification.guard';
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
  ].map(({ path, titre, description }) => ({
    path,
    title: `${titre} | Innov’Events`,
    data: { titre, description },
    loadComponent: () => import('./pages/page-attente/page-attente').then((m) => m.PageAttente),
  })),
  {
    path: 'contact',
    title: 'Contact | Innov’Events',
    loadComponent: () => import('./pages/contact/contact').then((m) => m.Contact),
  },
  {
    path: 'demande-devis',
    title: 'Demander un devis | Innov’Events',
    loadComponent: () => import('./pages/demande-devis/demande-devis').then((m) => m.DemandeDevis),
  },
  {
    path: 'administration/remerciement',
    title: 'Message de remerciement | Innov’Events',
    canActivate: [authentificationGuard],
    data: { admin: true },
    loadComponent: () => import('./pages/remerciement/remerciement').then((m) => m.Remerciement),
  },
  {
    path: 'espace',
    title: 'Mon espace | Innov’Events',
    canActivate: [authentificationGuard],
    loadComponent: () => import('./pages/espace/espace').then((m) => m.Espace),
  },
  {
    path: 'connexion',
    title: 'Connexion | Innov’Events',
    data: { mode: 'connexion' },
    loadComponent: () =>
      import('./pages/authentification/authentification').then((m) => m.Authentification),
  },
  {
    path: 'inscription',
    title: 'Créer un compte | Innov’Events',
    data: { mode: 'inscription' },
    loadComponent: () =>
      import('./pages/authentification/authentification').then((m) => m.Authentification),
  },
  {
    path: 'mot-de-passe-oublie',
    title: 'Mot de passe oublié | Innov’Events',
    data: { mode: 'oubli' },
    loadComponent: () =>
      import('./pages/authentification/authentification').then((m) => m.Authentification),
  },
  {
    path: 'nouveau-mot-de-passe',
    title: 'Nouveau mot de passe | Innov’Events',
    data: { mode: 'changement' },
    loadComponent: () =>
      import('./pages/authentification/authentification').then((m) => m.Authentification),
  },
  {
    path: '**',
    title: 'Page introuvable | Innov’Events',
    loadComponent: () =>
      import('./pages/page-introuvable/page-introuvable').then((m) => m.PageIntrouvable),
  },
];
