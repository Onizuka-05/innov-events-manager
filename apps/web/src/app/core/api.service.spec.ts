import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import { retourInterne } from './authentification.service';

describe('Appels API et destination de connexion', () => {
  let api: ApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it.each(['POST', 'PATCH', 'DELETE'] as const)(
    'joint le jeton de la session courante en %s',
    async (methode) => {
      const resultat = api.modifier(methode, '/essai', { nom: 'Camille' });
      http.expectOne('/api/csrf').flush({ jeton_csrf: 'premier' });
      await Promise.resolve();
      const envoi = http.expectOne('/api/essai');
      expect(envoi.request.method).toBe(methode);
      expect(envoi.request.headers.get('X-CSRF-Token')).toBe('premier');
      expect(envoi.request.body).toEqual({ nom: 'Camille' });
      envoi.flush({ ok: true });
      await resultat;
    },
  );

  it('redemande un jeton apres chaque changement de session', async () => {
    for (const token of ['ancienne-session', 'nouvelle-session']) {
      const resultat = api.modifier('POST', '/sessions', {});
      http.expectOne('/api/csrf').flush({ jeton_csrf: token });
      await Promise.resolve();
      const r = http.expectOne('/api/sessions');
      expect(r.request.headers.get('X-CSRF-Token')).toBe(token);
      r.flush({});
      await resultat;
    }
  });

  it.each([
    'https://exemple.org',
    '//exemple.org',
    '/\\exemple.org',
    '/connexion',
    '/mot-de-passe-oublie',
    '/a\nb',
  ])('refuse une destination non autorisee : %s', (valeur) => {
    expect(retourInterne(valeur)).toBe('/espace');
  });
  it('conserve le chemin interne, ses parametres et son ancre', () => {
    expect(retourInterne('/administration/remerciement?onglet=texte#message')).toBe(
      '/administration/remerciement?onglet=texte#message',
    );
  });
});
