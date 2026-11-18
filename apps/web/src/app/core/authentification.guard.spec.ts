import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ApiService } from './api.service';
import { AuthentificationService, type Utilisateur } from './authentification.service';
import { routes } from '../app.routes';

describe('Destination conservee avant connexion', () => {
  const utilisateur = signal<Utilisateur | null>(null);
  const restreinte = signal(false);
  beforeEach(() => {
    utilisateur.set(null);
    restreinte.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthentificationService,
          useValue: { utilisateur, restreinte, charger: vi.fn(() => Promise.resolve()) },
        },
        {
          provide: ApiService,
          useValue: { get: vi.fn(async () => ({ texte_remerciement: 'Merci' })) },
        },
      ],
    });
  });

  it('redirige vers la connexion avec la destination demandee', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/administration/parametres');
    const { Router } = await import('@angular/router');
    expect(TestBed.inject(Router).url).toBe('/connexion?retour=%2Fadministration%2Fparametres');
  });
  it('redirige une session restreinte vers le renouvellement en conservant la destination', async () => {
    restreinte.set(true);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/espace');
    const { Router } = await import('@angular/router');
    expect(TestBed.inject(Router).url).toBe('/nouveau-mot-de-passe?retour=%2Fespace');
  });
});

describe('Acces aux espaces de gestion', () => {
  it.each([
    ['client', true, false],
    ['employe', true, true],
    ['admin', true, true],
    ['client', false, false],
    ['employe', false, false],
    ['admin', false, true],
  ])('role %s equipe=%s autorise=%s', async (role, equipe, autorise) => {
    const { authentificationGuard } = await import('./authentification.guard');
    const { Router } = await import('@angular/router');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthentificationService,
          useValue: {
            charger: () => Promise.resolve(),
            restreinte: () => false,
            utilisateur: () => ({ role }),
          },
        },
      ],
    });
    const resultat = await TestBed.runInInjectionContext(() =>
      authentificationGuard(
        {
          data: equipe ? { equipe: true } : { admin: true },
        } as unknown as import('@angular/router').ActivatedRouteSnapshot,
        { url: '/equipe/clients' } as import('@angular/router').RouterStateSnapshot,
      ),
    );
    expect(resultat === true).toBe(autorise);
    if (!autorise)
      expect(
        TestBed.inject(Router).serializeUrl(resultat as import('@angular/router').UrlTree),
      ).toBe(role === 'employe' ? '/administration/evenements' : '/espace');
  });
});
