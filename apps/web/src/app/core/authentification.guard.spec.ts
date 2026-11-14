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
    await harness.navigateByUrl('/administration/remerciement');
    const { Router } = await import('@angular/router');
    expect(TestBed.inject(Router).url).toBe('/connexion?retour=%2Fadministration%2Fremerciement');
  });
  it('redirige une session restreinte vers le renouvellement en conservant la destination', async () => {
    restreinte.set(true);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/espace');
    const { Router } = await import('@angular/router');
    expect(TestBed.inject(Router).url).toBe('/nouveau-mot-de-passe?retour=%2Fespace');
  });
});
