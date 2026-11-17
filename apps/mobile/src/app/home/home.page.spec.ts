import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthentificationService } from '../core/authentification.service';
import type { Evenement } from '../core/gestion.types';

import { HomePage } from './home.page';

describe('Evenements mobiles', () => {
  const evenements: Evenement[] = [
    {
      id_evenement: '1',
      id_client: '7',
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
  function saisir(fixture: { nativeElement: HTMLElement }, selecteur: string, valeur: string) {
    const champ = fixture.nativeElement.querySelector(selecteur) as
      HTMLInputElement | HTMLSelectElement;
    champ.value = valeur;
    champ.dispatchEvent(new Event(champ instanceof HTMLSelectElement ? 'change' : 'input'));
  }
  const liste: Evenement[] = [
    { ...evenements[0], id_evenement: '1', nom: 'Séminaire Aster', statut_evenement: 'accepte' },
    {
      ...evenements[0],
      id_evenement: '2',
      nom: 'Gala',
      entreprise: 'Société Équinoxe',
      lieu: 'Marseille',
      statut_evenement: 'brouillon',
    },
    {
      ...evenements[0],
      id_evenement: '3',
      nom: 'Forum',
      entreprise: null,
      lieu: 'Paris, quai de Seine',
      statut_evenement: 'en_cours',
    },
  ];
  const noms = (el: HTMLElement) =>
    [...el.querySelectorAll('.evenements h2')].map((h) => h.textContent?.trim());
  it('recherche sur le nom, le client et le lieu sans tenir compte des accents ni de la casse', async () => {
    const { fixture, api } = preparer();
    api.get.mockResolvedValueOnce(liste);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    const statut = () => fixture.nativeElement.querySelector('.resultats[role="status"]');
    expect(statut().textContent).toContain('3 événements affichés sur 3');
    for (const [terme, attendu] of [
      ['seminaire', ['Séminaire Aster']],
      ['EQUINOXE', ['Gala']],
      ['quai seine', ['Forum']],
      ['lyon', ['Séminaire Aster']],
    ] as const) {
      saisir(fixture, '#recherche-evenements', terme);
      fixture.detectChanges();
      expect(noms(fixture.nativeElement)).toEqual(attendu);
    }
    expect(statut().textContent).toContain('1 événement affiché sur 3');
    saisir(fixture, '#recherche-evenements', 'introuvable');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucun événement ne correspond');
    expect(statut().textContent).toContain('0 événement affiché sur 3');
  });
  it('filtre par statut, cumule avec la recherche et reinitialise', async () => {
    const { fixture, api } = preparer();
    api.get.mockResolvedValueOnce(liste);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    const options = [
      ...(fixture.nativeElement.querySelectorAll(
        '#filtre-statut option',
      ) as NodeListOf<HTMLOptionElement>),
    ].map((o) => o.textContent?.trim());
    expect(options).toEqual(['Tous les statuts', 'Brouillon', 'Accepté', 'En cours']);
    expect(fixture.nativeElement.querySelector('label[for="filtre-statut"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('label[for="recherche-evenements"]')).toBeTruthy();
    saisir(fixture, '#filtre-statut', 'brouillon');
    fixture.detectChanges();
    expect(noms(fixture.nativeElement)).toEqual(['Gala']);
    saisir(fixture, '#recherche-evenements', 'forum');
    fixture.detectChanges();
    expect(noms(fixture.nativeElement)).toEqual([]);
    [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)]
      .find((b) => b.textContent?.includes('Réinitialiser'))!
      .click();
    fixture.detectChanges();
    expect(noms(fixture.nativeElement)).toHaveLength(3);
    expect(
      (fixture.nativeElement.querySelector('#recherche-evenements') as HTMLInputElement).value,
    ).toBe('');
  });
  it('ouvre la fiche de chaque evenement et propose les CGU et les CGV', async () => {
    const { fixture, api } = preparer();
    api.get.mockResolvedValueOnce(liste);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    const liens = [
      ...(fixture.nativeElement.querySelectorAll('.lien-carte') as NodeListOf<HTMLAnchorElement>),
    ].map((a) => a.getAttribute('href'));
    expect(liens).toEqual(['/evenements/1', '/evenements/2', '/evenements/3']);
    const legaux = [
      ...(fixture.nativeElement.querySelectorAll(
        '.liens-legaux a',
      ) as NodeListOf<HTMLAnchorElement>),
    ].map((a) => a.getAttribute('href'));
    expect(legaux).toEqual(['/cgu', '/cgv']);
  });
  it('affiche les dates au format francais', async () => {
    const { fixture, api } = preparer();
    api.get.mockResolvedValueOnce([
      {
        ...evenements[0],
        date_debut: '2027-01-28T09:00:00.000Z',
        date_fin: '2027-01-28T18:00:00.000Z',
      },
    ]);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('time').textContent).toMatch(
      /^28\/01\/2027 · \d{2}:00$/u,
    );
  });
});
