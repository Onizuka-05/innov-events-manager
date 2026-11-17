import type { Routes } from '@angular/router';

import { authentificationGuard } from './core/authentification.guard';

export const routes: Routes = [
  {
    path: 'home',
    canActivate: [authentificationGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'evenements/:id',
    canActivate: [authentificationGuard],
    loadComponent: () => import('./evenement/evenement.page').then((m) => m.EvenementPage),
  },
  {
    path: 'clients/:id',
    canActivate: [authentificationGuard],
    loadComponent: () => import('./client/client.page').then((m) => m.ClientPage),
  },
  // CGU et CGV : consultables sans connexion.
  ...(['cgu', 'cgv'] as const).map((page) => ({
    path: page,
    data: { page },
    loadComponent: () => import('./page-legale/page-legale.page').then((m) => m.PageLegalePage),
  })),
  ...[
    { path: 'connexion', mode: 'connexion' },
    { path: 'mot-de-passe-oublie', mode: 'oubli' },
    { path: 'nouveau-mot-de-passe', mode: 'changement' },
  ].map(({ path, mode }) => ({
    path,
    data: { mode },
    loadComponent: () => import('./connexion/connexion.page').then((m) => m.ConnexionPage),
  })),
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
