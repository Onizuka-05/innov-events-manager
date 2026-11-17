import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthentificationService } from '../core/authentification.service';

import { HomePage } from './home.page';

describe('Evenements mobiles', () => {
  const evenements = [
    {
      id_evenement: '1',
      nom: 'Salon',
      entreprise: 'Test SAS',
      date_debut: '2027-01-01T09:00:00+00:00',
      date_fin: '2027-01-01T18:00:00+00:00',
      lieu: 'Lyon',
      statut_evenement: 'accepte',
    },
  ];
  function preparer() {
    const api = { get: vi.fn(async () => evenements) };
    const auth = { deconnecter: vi.fn(async () => {}) };
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: AuthentificationService, useValue: auth },
      ],
    });
    return { fixture: TestBed.createComponent(HomePage), api, auth };
  }
  it('charge les evenements a venir a chaque ouverture Ionic', async () => {
    const { fixture, api } = preparer();
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(api.get).toHaveBeenCalledWith('/evenements?avenir=true');
    expect(fixture.nativeElement.textContent).toContain('Salon');
    await fixture.componentInstance.ionViewWillEnter();
    expect(api.get).toHaveBeenCalledTimes(2);
  });
  it('vide la liste et affiche une erreur si la session est perdue', async () => {
    const { fixture, api } = preparer();
    await fixture.componentInstance.ionViewWillEnter();
    api.get.mockRejectedValueOnce(new Error('Session invalide'));
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Salon');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });
  it('detruit la session a la deconnexion', async () => {
    const { fixture, auth } = preparer();
    fixture.detectChanges();
    [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)]
      .find((b) => b.textContent?.includes('déconnecter'))!
      .click();
    await fixture.whenStable();
    expect(auth.deconnecter).toHaveBeenCalled();
  });
  it('affiche des badges d’etat distincts pour Brouillon, Accepte et En cours', async () => {
    const { fixture, api } = preparer();
    api.get.mockResolvedValueOnce([
      { ...evenements[0], id_evenement: '1', statut_evenement: 'brouillon' },
      { ...evenements[0], id_evenement: '2', statut_evenement: 'accepte' },
      { ...evenements[0], id_evenement: '3', statut_evenement: 'en_cours' },
    ]);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    const badges = [
      ...(fixture.nativeElement.querySelectorAll('.statut') as NodeListOf<HTMLElement>),
    ];
    expect(badges.map((b) => b.textContent?.trim())).toEqual(['Brouillon', 'Accepté', 'En cours']);
    expect(badges.map((b) => b.className)).toEqual([
      'statut statut-neutre',
      'statut statut-succes',
      'statut statut-information',
    ]);
  });
  it('presente Se deconnecter en bouton secondaire, Actualiser en bouton principal', () => {
    const { fixture } = preparer();
    fixture.detectChanges();
    const boutons = [
      ...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>),
    ];
    const deconnexion = boutons.find((b) => b.textContent?.includes('déconnecter'))!;
    const actualiser = boutons.find((b) => b.textContent?.includes('Actualiser'))!;
    expect(deconnexion.classList.contains('bouton-secondaire')).toBe(true);
    expect(actualiser.classList.contains('bouton-secondaire')).toBe(false);
  });
});
