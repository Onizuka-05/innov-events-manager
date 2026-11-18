import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { ApiService } from '../../core/api.service';
import { ImageEvenement } from './image-evenement';
import { AvisPublics } from '../gestion/avis-publics';
import { TableauDeBord } from '../gestion/tableau-de-bord';
import { AuthentificationService } from '../../core/authentification.service';

const evenement = {
  id_evenement: '12',
  nom: 'Rencontres Aster',
  date_debut: '2027-01-20T09:00:00Z',
  date_fin: '2027-01-20T18:00:00Z',
  lieu: 'Lyon',
  statut_evenement: 'annule',
  libelle_type: 'Salon',
  libelle_theme: 'Nature',
  image_url: 'https://images.example.org/salon.jpg',
};
function preparer() {
  const api = {
    get: vi.fn(async (p: string): Promise<unknown> => {
      if (p === '/evenements-publics/filtres')
        return {
          types: [{ id_type_evenement: 1, libelle: 'Salon' }],
          themes: [{ id_theme: 2, libelle: 'Nature' }],
        };
      if (p.startsWith('/evenements-publics/')) return { ...evenement };
      if (p === '/avis')
        return [
          {
            id_avis: '1',
            commentaire: 'Très bien',
            note_evaluation: 4,
            evenement: evenement.nom,
            date_creation: '2026-11-17T10:00:00Z',
            nom_client: 'Nom interdit',
          },
        ];
      return {
        evenements: [evenement],
        total: 14,
        page: p.includes('page=2') ? 2 : 1,
        par_page: 12,
      };
    }),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), { provide: ApiService, useValue: api }],
  });
  return api;
}
function saisir(el: HTMLElement, selecteur: string, valeur: string) {
  const e = el.querySelector<HTMLInputElement>(selecteur)!;
  e.value = valeur;
  e.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Catalogue public et URL', () => {
  it('ignore un parametre inconnu dans l adresse et les liens de pagination', async () => {
    const api = preparer();
    const h = await RouterTestingHarness.create('/evenements?fbclid=lien-partage');
    await h.fixture.whenStable();
    h.detectChanges();
    expect(api.get).toHaveBeenCalledWith('/evenements-publics');
    expect(h.routeNativeElement!.textContent).toContain('Rencontres Aster');
    await h.navigateByUrl(
      '/evenements?du=2027-01-01&au=2027-02-01&type=1&theme=2&tri=ancien&fbclid=lien-partage',
    );
    await h.fixture.whenStable();
    h.detectChanges();
    expect(api.get).toHaveBeenCalledWith(
      '/evenements-publics?du=2027-01-01&au=2027-02-01&type=1&theme=2&tri=ancien',
    );
    const lien = h.routeNativeElement!.querySelector('a[rel="next"]')!;
    expect(lien.getAttribute('href')).toBe(
      '/evenements?du=2027-01-01&au=2027-02-01&type=1&theme=2&tri=ancien&page=2',
    );
    await h.navigateByUrl(lien.getAttribute('href')!);
    await h.fixture.whenStable();
    expect(api.get).toHaveBeenCalledWith(
      '/evenements-publics?du=2027-01-01&au=2027-02-01&type=1&theme=2&tri=ancien&page=2',
    );
    expect(api.get.mock.calls.some(([p]) => p.includes('fbclid'))).toBe(false);
  });
  it('affiche les informations publiques, le statut annule et aucun prix', async () => {
    const api = preparer();
    const h = await RouterTestingHarness.create('/evenements');
    await h.fixture.whenStable();
    h.detectChanges();
    const el = h.routeNativeElement!;
    expect(api.get).toHaveBeenCalledWith('/evenements-publics');
    for (const t of ['Rencontres Aster', 'Annulé', 'Lyon', 'Nature'])
      expect(el.textContent).toContain(t);
    expect(el.textContent).not.toMatch(/prix|€|HT|TTC/u);
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('Événement : Rencontres Aster');
    expect(el.querySelector('a[href="/evenements/12"]')).not.toBeNull();
  });
  it('restaure les filtres de l URL et les preserve pendant la pagination', async () => {
    const api = preparer();
    const h = await RouterTestingHarness.create(
      '/evenements?du=2027-01-01&type=1&theme=2&tri=ancien',
    );
    await h.fixture.whenStable();
    h.detectChanges();
    const el = h.routeNativeElement!;
    expect((el.querySelector('#du') as HTMLInputElement).value).toBe('2027-01-01');
    expect((el.querySelector('#type-public') as HTMLSelectElement).value).toBe('1');
    expect(api.get).toHaveBeenCalledWith(
      '/evenements-publics?du=2027-01-01&type=1&theme=2&tri=ancien',
    );
    const lien = el.querySelector('a[rel="next"]')!;
    expect(lien.getAttribute('href')).toContain('type=1');
    expect(lien.getAttribute('href')).toContain('page=2');
    await h.navigateByUrl(lien.getAttribute('href')!);
    await h.fixture.whenStable();
    h.detectChanges();
    expect(
      h.routeNativeElement!.querySelector('a[rel="prev"]')?.getAttribute('href'),
    ).not.toContain('page=');
  });
  it('reflete une recherche dans l URL et repart de la premiere page', async () => {
    preparer();
    const h = await RouterTestingHarness.create('/evenements?page=2');
    await h.fixture.whenStable();
    h.detectChanges();
    const el = h.routeNativeElement!;
    saisir(el, '#du', '2027-02-01');
    el.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await h.fixture.whenStable();
    h.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/evenements?du=2027-02-01');
    (el.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await h.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/evenements');
  });
  it('annonce le cas vide sans carte', async () => {
    const api = preparer();
    api.get.mockImplementation(async (p) =>
      p.endsWith('/filtres')
        ? { types: [], themes: [] }
        : { evenements: [], total: 0, page: 1, par_page: 12 },
    );
    const h = await RouterTestingHarness.create('/evenements');
    await h.fixture.whenStable();
    h.detectChanges();
    expect(h.routeNativeElement!.textContent).toContain('Aucun événement ne correspond');
    expect(h.routeNativeElement!.querySelector('article')).toBeNull();
  });
  it('affiche une erreur des filtres invalides sans la remplacer par un cas vide', async () => {
    const api = preparer();
    api.get.mockImplementation(async (p) => {
      if (p.endsWith('/filtres')) return { types: [], themes: [] };
      throw new HttpErrorResponse({
        status: 400,
        error: { erreur: 'Vérifiez les champs du formulaire.' },
      });
    });
    const h = await RouterTestingHarness.create('/evenements?du=2026-02-31');
    await h.fixture.whenStable();
    h.detectChanges();
    expect(api.get).toHaveBeenCalledWith('/evenements-publics?du=2026-02-31');
    expect(h.routeNativeElement!.querySelector('[role="alert"]')?.textContent).toContain(
      'Vérifiez',
    );
    expect(h.routeNativeElement!.textContent).not.toContain('Aucun événement ne correspond');
  });
  it('ignore une ancienne reponse recue apres une recherche plus recente', async () => {
    const api = preparer();
    let ancienne!: (v: unknown) => void;
    api.get.mockImplementation(async (p) => {
      if (p.endsWith('/filtres')) return { types: [], themes: [] };
      if (p.includes('type=1'))
        return new Promise((r) => {
          ancienne = r;
        });
      return {
        evenements: [{ ...evenement, nom: 'Résultat récent' }],
        total: 1,
        page: 1,
        par_page: 12,
      };
    });
    const h = await RouterTestingHarness.create('/evenements?type=1');
    await h.navigateByUrl('/evenements?type=2');
    await h.fixture.whenStable();
    h.detectChanges();
    ancienne({
      evenements: [{ ...evenement, nom: 'Ancien résultat' }],
      total: 1,
      page: 1,
      par_page: 12,
    });
    await h.fixture.whenStable();
    h.detectChanges();
    expect(h.routeNativeElement!.textContent).toContain('Résultat récent');
    expect(h.routeNativeElement!.textContent).not.toContain('Ancien résultat');
  });
  it('annonce le chargement sans afficher de resultat vide', async () => {
    const api = preparer();
    let terminer!: (v: unknown) => void;
    api.get.mockImplementation(async (p) =>
      p.endsWith('/filtres')
        ? { types: [], themes: [] }
        : new Promise((r) => {
            terminer = r;
          }),
    );
    const h = await RouterTestingHarness.create('/evenements');
    h.detectChanges();
    expect(h.routeNativeElement!.querySelector('[role="status"]')?.textContent).toContain(
      'Chargement',
    );
    terminer({ evenements: [], total: 0, page: 1, par_page: 12 });
    await h.fixture.whenStable();
  });
});

describe('Reprise du chargement public', () => {
  it('retente la meme URL apres une indisponibilite temporaire', async () => {
    const api = preparer();
    let enPanne = true;
    api.get.mockImplementation(async (p) => {
      if (p.endsWith('/filtres')) return { types: [], themes: [] };
      if (enPanne)
        throw new HttpErrorResponse({ status: 503, error: { erreur: 'Service indisponible' } });
      return { evenements: [evenement], total: 1, page: 1, par_page: 12 };
    });
    const h = await RouterTestingHarness.create('/evenements?type=1&fbclid=lien-partage');
    await h.fixture.whenStable();
    h.detectChanges();
    enPanne = false;
    const bouton = [...h.routeNativeElement!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Réessayer le chargement'),
    )!;
    bouton.click();
    await h.fixture.whenStable();
    h.detectChanges();
    expect(h.routeNativeElement!.textContent).toContain('Rencontres Aster');
    expect(api.get.mock.calls.filter(([p]) => p === '/evenements-publics?type=1')).toHaveLength(2);
    expect(api.get.mock.calls.some(([p]) => p.includes('fbclid'))).toBe(false);
  });
});

describe('Detail public et couvertures', () => {
  it('contient les informations et une section Prestations et Devis avec son lien', async () => {
    preparer();
    const h = await RouterTestingHarness.create('/evenements/12');
    await h.fixture.whenStable();
    h.detectChanges();
    const el = h.routeNativeElement!;
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.textContent).toContain('Annulé');
    expect(el.querySelector('#prestations-devis')?.textContent).toBe('Prestations et Devis');
    expect(el.querySelector('a[href="/demande-devis"]')).not.toBeNull();
    expect(el.textContent).not.toMatch(/€|TTC|HT/u);
  });
  it('affiche le 404 puis charge un autre identifiant sans conserver l ancien evenement', async () => {
    const api = preparer();
    api.get.mockRejectedValueOnce(new HttpErrorResponse({ status: 404 }));
    const h = await RouterTestingHarness.create('/evenements/99');
    await h.fixture.whenStable();
    h.detectChanges();
    expect(h.routeNativeElement!.textContent).toContain('introuvable ou non publié');
    expect(h.routeNativeElement!.querySelector('a[href="/evenements"]')).not.toBeNull();
    await h.navigateByUrl('/evenements/12');
    await h.fixture.whenStable();
    h.detectChanges();
    expect(h.routeNativeElement!.querySelectorAll('h1')).toHaveLength(1);
    expect(h.routeNativeElement!.textContent).toContain('Rencontres Aster');
  });
  it('refuse un identifiant invalide sans appeler l API', async () => {
    const api = preparer();
    const h = await RouterTestingHarness.create('/evenements/incorrect');
    await h.fixture.whenStable();
    h.detectChanges();
    expect(api.get).not.toHaveBeenCalled();
    expect(h.routeNativeElement!.textContent).toContain('Événement introuvable');
  });
  it('remplace une image absente, non HTTPS ou inaccessible par un repli', async () => {
    const f = TestBed.createComponent(ImageEvenement);
    f.componentRef.setInput('nom', 'Test');
    f.componentRef.setInput('url', null);
    f.detectChanges();
    expect(f.nativeElement.querySelector('img')).toBeNull();
    f.componentRef.setInput('url', 'http://example.org/image.jpg');
    f.detectChanges();
    expect(f.nativeElement.querySelector('img')).toBeNull();
    f.componentRef.setInput('url', 'https://example.org/image.jpg');
    f.detectChanges();
    f.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    f.detectChanges();
    expect(f.nativeElement.querySelector('img')).toBeNull();
    expect(f.nativeElement.querySelector('.image-repli')).not.toBeNull();
  });
});

describe('Avis publics et tableau de bord', () => {
  it('reserve le separateur de contact aux clients dont le nom est renseigne', async () => {
    const api = preparer();
    api.get.mockImplementation(async (p) => {
      if (p === '/administration/tableau-de-bord')
        return {
          prochains_evenements: [
            { ...evenement, entreprise: null, prenom_contact: null, nom_contact: null },
            {
              ...evenement,
              id_evenement: '13',
              entreprise: 'Test SAS',
              prenom_contact: 'Léa',
              nom_contact: 'Martin',
            },
          ],
          notes_recentes: [],
          clients_actifs: [],
          brouillons: [],
        };
      return [];
    });
    TestBed.overrideProvider(AuthentificationService, {
      useValue: { utilisateur: () => ({ role: 'admin', id_utilisateur: '1' }) },
    });
    const f = TestBed.createComponent(TableauDeBord);
    await f.whenStable();
    f.detectChanges();
    const contacts = [
      ...f.nativeElement.querySelectorAll('.liste-bord:first-of-type li > p:first-of-type'),
    ].map((p: Element) => p.textContent?.replace(/\s+/gu, ' ').trim());
    expect(contacts).toEqual(['Client anonymisé', 'Test SAS · Léa Martin']);
  });
  it('affiche note, date et evenement sans nom de client', async () => {
    preparer();
    const f = TestBed.createComponent(AvisPublics);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('4 sur 5');
    expect(f.nativeElement.querySelector('time').textContent).toContain('17/11/2026');
    expect(f.nativeElement.textContent).not.toContain('Nom interdit');
  });
  it('affiche le cas vide des avis puis les erreurs de lecture', async () => {
    const api = preparer();
    api.get.mockResolvedValueOnce([]);
    const f = TestBed.createComponent(AvisPublics);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Aucun avis publié');
    TestBed.resetTestingModule();
    const autre = preparer();
    autre.get.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const g = TestBed.createComponent(AvisPublics);
    await g.whenStable();
    g.detectChanges();
    expect(g.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('presente les chiffres en valeur, les dates et les badges depuis les routes existantes', async () => {
    const api = preparer();
    api.get.mockImplementation(async (p) => {
      if (p === '/administration/tableau-de-bord')
        return {
          prochains_evenements: [{ ...evenement, entreprise: 'Test SAS' }],
          notes_recentes: [],
          clients_actifs: [{ id_client: '2', entreprise: 'Test SAS' }],
          brouillons: [{ ...evenement, id_evenement: '13', entreprise: 'Test SAS' }],
        };
      if (p === '/evenements')
        return [
          { ...evenement, statut_evenement: 'accepte' },
          { ...evenement, id_evenement: '13', statut_evenement: 'brouillon' },
        ];
      return [];
    });
    TestBed.overrideProvider(AuthentificationService, {
      useValue: { utilisateur: () => ({ role: 'admin', id_utilisateur: '1' }) },
    });
    const f = TestBed.createComponent(TableauDeBord);
    await f.whenStable();
    f.detectChanges();
    expect(
      [...f.nativeElement.querySelectorAll('.indicateurs dd')].map((e: Element) =>
        e.textContent?.trim(),
      ),
    ).toEqual(['1', '1']);
    expect(f.nativeElement.querySelectorAll('.liste-bord')).toHaveLength(4);
    expect(f.nativeElement.querySelectorAll('.liste-bord time')).toHaveLength(2);
    expect(f.nativeElement.textContent).toContain('Accepté');
    expect(f.nativeElement.textContent).toContain('Brouillon');
  });
});
