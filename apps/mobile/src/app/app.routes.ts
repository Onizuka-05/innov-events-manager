import type { Routes } from '@angular/router';

import { authentificationGuard } from './core/authentification.guard';

export const routes: Routes = [
  {
    path: 'home',
    canActivate: [authentificationGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
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
