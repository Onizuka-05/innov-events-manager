import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { routes } from '../app.routes';

import { PAGES_LEGALES } from './contenus-legaux';
import { PageLegalePage } from './page-legale.page';

describe('CGU et CGV mobiles', () => {
  function ouvrir(page: 'cgu' | 'cgv') {
    TestBed.configureTestingModule({
      imports: [PageLegalePage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { page } } } },
      ],
    });
    const fixture = TestBed.createComponent(PageLegalePage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it.each(['cgu', 'cgv'] as const)('affiche toutes les sections de la page %s', (page) => {
    const el = ouvrir(page);
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toContain(PAGES_LEGALES[page].titre);
    expect([...el.querySelectorAll('h2')].map((h) => h.textContent?.trim())).toEqual(
      PAGES_LEGALES[page].sections.map((s) => s.titre),
    );
    for (const section of PAGES_LEGALES[page].sections)
      for (const paragraphe of section.paragraphes) expect(el.textContent).toContain(paragraphe);
  });
  it('relie les CGU aux CGV et inversement', () => {
    expect(ouvrir('cgu').querySelector('.liens-legaux a')?.getAttribute('href')).toBe('/cgv');
    TestBed.resetTestingModule();
    expect(ouvrir('cgv').querySelector('.liens-legaux a')?.getAttribute('href')).toBe('/cgu');
  });
  it('reprend les titres du site et laisse les pages accessibles sans connexion', () => {
    expect(PAGES_LEGALES.cgu.titre).toBe('Conditions générales d’utilisation');
    expect(PAGES_LEGALES.cgv.titre).toBe('Conditions générales de vente');
    for (const chemin of ['cgu', 'cgv']) {
      const route = routes.find((r) => r.path === chemin);
      expect(route?.canActivate).toBeUndefined();
    }
    for (const chemin of ['home', 'evenements/:id', 'clients/:id'])
      expect(routes.find((r) => r.path === chemin)?.canActivate).toHaveLength(1);
  });
});
