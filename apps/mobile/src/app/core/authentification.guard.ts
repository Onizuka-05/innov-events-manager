import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthentificationService } from './authentification.service';
/** Protection ergonomique ; les routes API controlent aussi le role. */
export const authentificationGuard: CanActivateFn = async () => {
  const auth = inject(AuthentificationService),
    router = inject(Router);
  try {
    await auth.charger();
  } catch {
    return router.createUrlTree(['/connexion']);
  }
  if (auth.restreinte()) return router.createUrlTree(['/nouveau-mot-de-passe']);
  if (!auth.utilisateur() || !['admin', 'employe'].includes(auth.utilisateur()!.role))
    return router.createUrlTree(['/connexion']);
  return true;
};
