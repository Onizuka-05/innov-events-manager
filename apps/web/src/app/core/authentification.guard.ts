import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthentificationService, accueilRole } from './authentification.service';

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
  const role = auth.utilisateur()!.role;
  const accueil = accueilRole(role);
  if (route.data['equipe'] && !['admin', 'employe'].includes(role))
    return router.createUrlTree(['/espace']);
  if (route.data['admin'] && role !== 'admin') return router.createUrlTree([accueil]);
  if (route.data['espace'] && role !== 'client') return router.createUrlTree([accueil]);
  if (route.data['devis']) {
    if (role === 'admin')
      return router.createUrlTree(['/administration/devis'], { queryParams: route.queryParams });
    if (role === 'employe') return router.createUrlTree([accueil]);
    return router.createUrlTree(['/espace/devis'], { queryParams: route.queryParams });
  }
  return true;
};
