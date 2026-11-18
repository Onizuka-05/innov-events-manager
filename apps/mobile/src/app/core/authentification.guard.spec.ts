import { TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  type ActivatedRouteSnapshot,
  type UrlTree,
  type RouterStateSnapshot,
} from '@angular/router';

import { authentificationGuard } from './authentification.guard';
import { AuthentificationService } from './authentification.service';

describe('Protection de l’espace mobile', () => {
  it.each([
    ['employe', false, true],
    ['admin', false, true],
    ['client', false, false],
    ['', false, false],
    ['employe', true, false],
  ])('controle %s restreinte=%s', async (role, restreinte, autorise) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthentificationService,
          useValue: {
            charger: async () => {},
            restreinte: () => restreinte,
            utilisateur: () => (role ? { role } : null),
          },
        },
      ],
    });
    const r = await TestBed.runInInjectionContext(() =>
      authentificationGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(r === true).toBe(autorise);
    if (!autorise)
      expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe(
        restreinte ? '/nouveau-mot-de-passe' : '/connexion',
      );
  });
});
