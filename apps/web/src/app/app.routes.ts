import { authentificationGuard } from './core/authentification.guard';
import { inject } from '@angular/core';
import { Router, type Routes, type RedirectFunction } from '@angular/router';

export const routes: Routes = [
  {
    path: 'administration',
    canActivate: [authentificationGuard],
    data: { equipe: true },
    loadComponent: () => import('./pages/gestion/espace-equipe').then((m) => m.EspaceEquipe),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: "Tableau de bord | Innov'Events",
        canActivate: [authentificationGuard],
        data: { admin: true },
        loadComponent: () => import('./pages/gestion/tableau-de-bord').then((m) => m.TableauDeBord),
      },
      {
        path: 'prospects',
        title: "Prospects | Innov'Events",
        canActivate: [authentificationGuard],
        data: { admin: true },
        loadComponent: () => import('./pages/gestion/prospects').then((m) => m.Prospects),
      },
      {
        path: 'clients',
        canActivate: [authentificationGuard],
        data: { equipe: true },
        title: "Clients | Innov'Events",
        loadComponent: () => import('./pages/gestion/clients').then((m) => m.Clients),
      },
      {
        path: 'evenements',
        canActivate: [authentificationGuard],
        data: { equipe: true },
        title: "Événements | Innov'Events",
        loadComponent: () => import('./pages/gestion/evenements').then((m) => m.EvenementsGestion),
      },
      {
        path: 'devis',
        title: "Devis | Innov'Events",
        canActivate: [authentificationGuard],
        data: { admin: true },
        loadComponent: () => import('./pages/devis/devis').then((m) => m.Devis),
      },
      {
        path: 'taches',
        canActivate: [authentificationGuard],
        data: { equipe: true },
        title: "Tâches | Innov'Events",
        loadComponent: () => import('./pages/gestion/taches').then((m) => m.Taches),
      },
      {
        path: 'avis',
        canActivate: [authentificationGuard],
        data: { equipe: true },
        title: "Avis | Innov'Events",
        loadComponent: () => import('./pages/gestion/moderation').then((m) => m.Moderation),
      },
      {
        path: 'comptes',
        title: "Comptes | Innov'Events",
        canActivate: [authentificationGuard],
        data: { admin: true },
        loadComponent: () => import('./pages/gestion/comptes').then((m) => m.Comptes),
      },
      {
        path: 'journaux',
        title: "Journaux | Innov'Events",
        canActivate: [authentificationGuard],
        data: { admin: true },
        loadComponent: () => import('./pages/gestion/journaux').then((m) => m.Journaux),
      },
      {
        path: 'parametres',
        title: "Paramètres | Innov'Events",
        canActivate: [authentificationGuard],
        data: { admin: true },
        loadComponent: () =>
          import('./pages/remerciement/remerciement').then((m) => m.Remerciement),
      },
      { path: 'remerciement', pathMatch: 'full', redirectTo: 'parametres' },
    ],
  },
  ...['clients', 'evenements', 'avis'].map((rubrique) => ({
    path: `equipe/${rubrique}`,
    redirectTo: (({ queryParams }) =>
      inject(Router).createUrlTree(['/administration', rubrique], {
        queryParams,
      })) as RedirectFunction,
  })),
  {
    path: 'avis',
    title: 'Avis | Innov’Events',
    loadComponent: () => import('./pages/gestion/avis-publics').then((m) => m.AvisPublics),
  },
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
  {
    path: 'evenements',
    title: 'Événements | Innov’Events',
    loadComponent: () => import('./pages/catalogue/catalogue').then((m) => m.Catalogue),
  },
  {
    path: 'evenements/:id',
    title: 'Événement | Innov’Events',
    loadComponent: () =>
      import('./pages/catalogue/detail-evenement').then((m) => m.DetailEvenement),
  },
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
    path: 'devis',
    title: 'Mes devis | Innov’Events',
    canActivate: [authentificationGuard],
    data: { devis: true },
    loadComponent: () => import('./pages/devis/devis').then((m) => m.Devis),
  },
  {
    path: 'espace',
    canActivate: [authentificationGuard],
    data: { espace: true },
    loadComponent: () => import('./pages/espace/espace').then((m) => m.Espace),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Accueil de mon espace | Innov’Events',
        canActivate: [authentificationGuard],
        data: { espace: true },
        loadComponent: () => import('./pages/espace/accueil-client').then((m) => m.AccueilClient),
      },
      {
        path: 'devis',
        title: 'Mes devis | Innov’Events',
        canActivate: [authentificationGuard],
        data: { espace: true },
        loadComponent: () => import('./pages/devis/devis').then((m) => m.Devis),
      },
      {
        path: 'evenements',
        title: 'Mes événements | Innov’Events',
        canActivate: [authentificationGuard],
        data: { espace: true },
        loadComponent: () =>
          import('./pages/espace/evenements-client').then((m) => m.EvenementsClient),
      },
      {
        path: 'profil',
        title: 'Mon profil | Innov’Events',
        canActivate: [authentificationGuard],
        data: { espace: true },
        loadComponent: () => import('./pages/espace/profil-client').then((m) => m.ProfilClientPage),
      },
    ],
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
