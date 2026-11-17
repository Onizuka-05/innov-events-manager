import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { ApiService } from '../core/api.service';
import type { FicheEvenement } from '../core/gestion.types';

import { EvenementPage } from './evenement.page';

describe('Fiche evenement mobile', () => {
  const fiche: FicheEvenement = {
    id_evenement: '4',
    id_client: '9',
    nom: 'Séminaire Aster',
    date_debut: '2027-01-28T09:00:00.000Z',
    date_fin: '2027-01-28T18:00:00.000Z',
    lieu: 'Paris, adresse du lieu',
    statut_evenement: 'accepte',
    entreprise: 'Société Aster',
    notes: [
      {
        id_note: '1',
        contenu: 'Prévoir les badges des invités.',
        date_creation: '2027-01-20T10:00:00.000Z',
        prenom: 'José',
        nom: 'Test',
      },
    ],
  };
  function preparer(id = '4') {
    const api = {
      get: vi.fn(async (): Promise<unknown> => structuredClone(fiche)),
      modifier: vi.fn(async (): Promise<unknown> => ({ id_note: '2' })),
    };
    TestBed.configureTestingModule({
      imports: [EvenementPage],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
        },
      ],
    });
    return { fixture: TestBed.createComponent(EvenementPage), api };
  }
  async function ouvrir(id = '4') {
    const r = preparer(id);
    await r.fixture.componentInstance.ionViewWillEnter();
    r.fixture.detectChanges();
    return r;
  }
  const boutons = (el: HTMLElement) => [...el.querySelectorAll('button')] as HTMLButtonElement[];
  const bouton = (el: HTMLElement, texte: string) =>
    boutons(el).find((b) => b.textContent?.includes(texte))!;

  it('affiche nom, dates, lieu, statut, client et notes de l evenement', async () => {
    const { fixture, api } = await ouvrir();
    const el = fixture.nativeElement as HTMLElement;
    expect(api.get).toHaveBeenCalledWith('/evenements/4');
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toContain('Séminaire Aster');
    expect(el.querySelector('.statut')?.className).toBe('statut statut-succes');
    expect(el.querySelector('.statut')?.textContent?.trim()).toBe('Accepté');
    expect(el.querySelector('time')?.textContent).toMatch(/^28\/01\/2027 · \d{2}:00$/u);
    expect(el.textContent).toContain('Paris, adresse du lieu');
    expect(el.textContent).toContain('Prévoir les badges des invités.');
    const lienClient = [...el.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('fiche client'),
    );
    expect(lienClient?.getAttribute('href')).toBe('/clients/9?evenement=4');
    expect([...el.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/home')).toBe(
      true,
    );
  });
  it('place le bouton Ajouter une note en haut de la fiche, en bouton principal pleine largeur', async () => {
    const { fixture } = await ouvrir();
    const el = fixture.nativeElement as HTMLElement;
    const ajout = bouton(el, 'Ajouter une note');
    expect(ajout.classList.contains('bouton-pleine-largeur')).toBe(true);
    expect(ajout.classList.contains('bouton-secondaire')).toBe(false);
    const informations = el.querySelector('#titre-informations')!;
    expect(
      ajout.compareDocumentPosition(informations) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
  it('enregistre une note, confirme et l affiche dans la liste', async () => {
    const { fixture, api } = await ouvrir();
    const el = fixture.nativeElement as HTMLElement;
    bouton(el, 'Ajouter une note').click();
    fixture.detectChanges();
    const zone = el.querySelector('#nouvelle-note') as HTMLTextAreaElement;
    expect(el.querySelector('label[for="nouvelle-note"]')?.textContent).toContain('Nouvelle note');
    zone.value = '  Vérifier l’accès livraison.  ';
    zone.dispatchEvent(new Event('input'));
    api.get.mockResolvedValueOnce({
      ...structuredClone(fiche),
      notes: [
        {
          id_note: '2',
          contenu: 'Vérifier l’accès livraison.',
          date_creation: '2027-01-21T10:00:00.000Z',
          prenom: 'José',
          nom: 'Test',
        },
        ...fiche.notes,
      ],
    });
    bouton(el, 'Enregistrer la note').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.modifier).toHaveBeenCalledWith('POST', '/notes', {
      id_evenement: '4',
      contenu: 'Vérifier l’accès livraison.',
    });
    expect(el.querySelector('.confirmation[role="status"]')?.textContent).toContain(
      'Note enregistrée',
    );
    expect(el.querySelector('#nouvelle-note')).toBeNull();
    expect([...el.querySelectorAll('.contenu-note')].map((n) => n.textContent)).toEqual([
      'Vérifier l’accès livraison.',
      'Prévoir les badges des invités.',
    ]);
  });
  it('n envoie la note qu une fois en cas de double appui', async () => {
    const { fixture, api } = await ouvrir();
    const el = fixture.nativeElement as HTMLElement;
    bouton(el, 'Ajouter une note').click();
    fixture.detectChanges();
    const zone = el.querySelector('#nouvelle-note') as HTMLTextAreaElement;
    zone.value = 'Note unique';
    zone.dispatchEvent(new Event('input'));
    let terminer!: (v: unknown) => void;
    api.modifier.mockReturnValueOnce(new Promise((r) => (terminer = r)));
    const formulaire = el.querySelector('form')!;
    formulaire.dispatchEvent(new Event('submit'));
    formulaire.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(bouton(el, 'Enregistrement').disabled).toBe(true);
    terminer({ id_note: '3' });
    await fixture.whenStable();
    expect(api.modifier).toHaveBeenCalledTimes(1);
  });
  it('refuse une note vide et affiche l erreur du serveur sans perdre le texte', async () => {
    const { fixture, api } = await ouvrir();
    const el = fixture.nativeElement as HTMLElement;
    bouton(el, 'Ajouter une note').click();
    fixture.detectChanges();
    const zone = el.querySelector('#nouvelle-note') as HTMLTextAreaElement;
    zone.value = '   ';
    zone.dispatchEvent(new Event('input'));
    bouton(el, 'Enregistrer la note').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.modifier).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Saisissez le texte');
    expect(zone.getAttribute('aria-invalid')).toBe('true');
    zone.value = 'Texte conservé';
    zone.dispatchEvent(new Event('input'));
    api.modifier.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 403, error: { erreur: 'Accès refusé.' } }),
    );
    bouton(el, 'Enregistrer la note').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Accès refusé.');
    expect((el.querySelector('#nouvelle-note') as HTMLTextAreaElement).value).toBe(
      'Texte conservé',
    );
  });
  it('ferme la saisie sans envoyer avec Annuler', async () => {
    const { fixture, api } = await ouvrir();
    const el = fixture.nativeElement as HTMLElement;
    bouton(el, 'Ajouter une note').click();
    fixture.detectChanges();
    bouton(el, 'Annuler').click();
    fixture.detectChanges();
    expect(el.querySelector('#nouvelle-note')).toBeNull();
    expect(api.modifier).not.toHaveBeenCalled();
  });
  it('affiche l erreur de chargement et refuse un identifiant invalide sans appel', async () => {
    const { fixture, api } = preparer();
    api.get.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 404, error: { erreur: 'Événement introuvable.' } }),
    );
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Événement introuvable.',
    );
    TestBed.resetTestingModule();
    const autre = await ouvrir('abc');
    expect(autre.api.get).not.toHaveBeenCalled();
    expect(autre.fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'introuvable',
    );
  });
  it('signale un client anonymise sans lien vers sa fiche', async () => {
    const { fixture, api } = preparer();
    api.get.mockResolvedValueOnce({ ...structuredClone(fiche), entreprise: null });
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Client anonymisé');
    expect(fixture.nativeElement.querySelector('a[href^="/clients"]')).toBeNull();
  });
});
