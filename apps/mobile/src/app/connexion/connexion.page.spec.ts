import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthentificationService } from '../core/authentification.service';

import { ConnexionPage } from './connexion.page';

describe('Connexion mobile', () => {
  function preparer(mode = 'connexion') {
    const auth = {
      charger: vi.fn(async () => {}),
      connecter: vi.fn(async () => {}),
      deconnecter: vi.fn(async () => {}),
      utilisateur: () => ({ role: 'client' }),
      restreinte: () => false,
    };
    const api = { modifier: vi.fn(async () => ({ message: 'Envoyé' })) };
    TestBed.configureTestingModule({
      imports: [ConnexionPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { mode } } } },
        { provide: ApiService, useValue: api },
        { provide: AuthentificationService, useValue: auth },
      ],
    });
    return { fixture: TestBed.createComponent(ConnexionPage), api, auth };
  }
  it('refuse l’espace employe au compte client', async () => {
    const { fixture, auth } = preparer();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(auth.deconnecter).toHaveBeenCalled();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('réservé aux employés');
    });
  });
  it('ne demande que le nouveau mot de passe dans la session restreinte', () => {
    const { fixture } = preparer('changement');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#email-mobile')).toBeNull();
    expect(fixture.nativeElement.querySelector('#mot-mobile')).toBeTruthy();
  });
  it('demande l’e-mail pour le mot de passe oublie', () => {
    const { fixture } = preparer('oubli');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#email-mobile')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#mot-mobile')).toBeNull();
  });
});
