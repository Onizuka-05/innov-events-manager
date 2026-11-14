import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthentificationService } from './authentification.service';

/** Conserve la destination ; le serveur reste seul responsable de l'autorisation. */
export const authentificationGuard: CanActivateFn = async (route, etat) => {
  const auth = inject(AuthentificationService);
  const router = inject(Router);
  try {
    await auth.charger();
  } catch {
    return router.createUrlTree(['/connexion'], { queryParams: { retour: etat.url } });
  }
  if (auth.restreinte())
    return router.createUrlTree(['/nouveau-mot-de-passe'], { queryParams: { retour: etat.url } });
  if (!auth.utilisateur())
    return router.createUrlTree(['/connexion'], { queryParams: { retour: etat.url } });
  return (
    !route.data['admin'] ||
    auth.utilisateur()?.role === 'admin' ||
    router.createUrlTree(['/espace'])
  );
};
