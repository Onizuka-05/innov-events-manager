import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('Site public', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await router.navigateByUrl('/');
    await fixture.whenStable();
  });

  it('presente un seul titre principal et deux illustrations locales decrites', () => {
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toContain('rassemblent');
    const images = [...element.querySelectorAll('main img')];
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image.getAttribute('src')).toMatch(/^\/images\/.+\.svg$/);
      expect(image.getAttribute('alt')?.length).toBeGreaterThan(15);
      expect(image.hasAttribute('width') && image.hasAttribute('height')).toBe(true);
    }
  });

  it('dirige le bouton principal vers la route de demande de devis sans simuler un envoi', async () => {
    const lien = element.querySelector<HTMLAnchorElement>('main a.bouton-primaire');
    expect(lien?.getAttribute('href')).toBe('/demande-devis');
    lien?.click();
    await fixture.whenStable();
    expect(router.url).toBe('/demande-devis');
    expect(element.querySelector('h1')?.textContent).toBe('Demander un devis');
    expect(element.querySelector('main')?.textContent).toContain(
      'Aucune demande ne peut être envoyée',
    );
    expect(element.querySelector('form')).toBeNull();
  });

  it('expose les six entrees de navigation et marque seulement la page courante', async () => {
    const liens = [...element.querySelectorAll('header nav a')].map((lien) =>
      lien.getAttribute('href'),
    );
    expect(liens).toEqual([
      '/',
      '/evenements',
      '/avis',
      '/contact',
      '/connexion',
      '/demande-devis',
    ]);
    await router.navigateByUrl('/contact');
    await fixture.whenStable();
    expect(element.querySelectorAll('header [aria-current="page"]')).toHaveLength(1);
    expect(element.querySelector('header [aria-current="page"]')?.getAttribute('href')).toBe(
      '/contact',
    );
  });

  it('ouvre le menu avec un bouton et le referme avec Echap en rendant le focus', async () => {
    const bouton = element.querySelector<HTMLButtonElement>('.bouton-menu');
    expect(bouton?.getAttribute('aria-expanded')).toBe('false');
    bouton?.click();
    await fixture.whenStable();
    expect(bouton?.getAttribute('aria-expanded')).toBe('true');
    const lien = element.querySelector<HTMLAnchorElement>('header nav a');
    lien?.focus();
    // jsdom ne calcule pas les media queries : le focus reel est verifie dans le navigateur.
    const retourFocus = vi.spyOn(bouton as HTMLButtonElement, 'focus');
    lien?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(bouton?.getAttribute('aria-expanded')).toBe('false');
    expect(retourFocus).toHaveBeenCalledOnce();
  });

  it('atteint le contenu depuis une page legale sans revenir a l’accueil', async () => {
    await router.navigateByUrl('/cgu');
    await fixture.whenStable();
    element.querySelector<HTMLAnchorElement>('.lien-evitement')?.click();
    await fixture.whenStable();
    expect(router.url).toBe('/cgu');
    expect(document.activeElement).toBe(element.querySelector('main'));
  });

  it('referme le menu et place le focus sur le contenu apres navigation', async () => {
    const bouton = element.querySelector<HTMLButtonElement>('.bouton-menu');
    bouton?.click();
    await fixture.whenStable();
    await router.navigateByUrl('/mentions-legales');
    await fixture.whenStable();
    expect(bouton?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(element.querySelector('main'));
  });

  it('ferme le menu et place le focus sur le contenu en choisissant la page courante', async () => {
    const bouton = element.querySelector<HTMLButtonElement>('.bouton-menu');
    bouton?.click();
    await fixture.whenStable();
    const accueil = element.querySelector<HTMLAnchorElement>('header nav a[href="/"]');
    accueil?.focus();
    accueil?.click();
    await fixture.whenStable();
    expect(router.url).toBe('/');
    expect(bouton?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(element.querySelector('main'));
  });

  it.each([
    ['/', 'Des événements'],
    ['/mentions-legales', 'Mentions légales'],
    ['/cgu', 'Conditions générales d’utilisation'],
    ['/cgv', 'Conditions générales de vente'],
    ['/confidentialite', 'Politique de confidentialité'],
    ['/evenements', 'Événements'],
    ['/avis', 'Avis'],
    ['/contact', 'Contact'],
    ['/connexion', 'Connexion'],
    ['/demande-devis', 'Demander un devis'],
    ['/adresse-inconnue', 'Page introuvable'],
  ])('garde le gabarit et un titre coherent sur %s', async (url, titre) => {
    await router.navigateByUrl(url);
    await fixture.whenStable();
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toContain(titre);
    expect(element.querySelector('header nav')).not.toBeNull();
    expect(element.querySelector('footer nav')).not.toBeNull();
    expect(document.title).toContain('Innov’Events');
    expect(element.querySelector('.lien-evitement')?.getAttribute('href')).toBe('#contenu');
    expect(element.querySelectorAll('footer nav a')).toHaveLength(4);
  });

  it('actualise le texte quand Angular reutilise le composant des pages legales', async () => {
    await router.navigateByUrl('/cgu');
    await fixture.whenStable();
    expect(element.querySelector('h1')?.textContent).toBe('Conditions générales d’utilisation');
    await router.navigateByUrl('/confidentialite');
    await fixture.whenStable();
    expect(element.querySelector('h1')?.textContent).toBe('Politique de confidentialité');
    expect(element.querySelector('main')?.textContent).toContain('pseudonymisés');
    expect(element.querySelector('main')?.textContent).not.toContain('Objet et accès au site');
  });

  it.each([
    ['/mentions-legales', 'Mentions légales'],
    ['/cgu', 'Conditions générales d’utilisation'],
    ['/cgv', 'Conditions générales de vente'],
    ['/confidentialite', 'Politique de confidentialité'],
  ])('ouvre la page %s depuis le pied de page', async (url, titre) => {
    const lien = element.querySelector<HTMLAnchorElement>(`footer a[href="${url}"]`);
    expect(lien).not.toBeNull();
    lien?.click();
    await fixture.whenStable();
    expect(router.url).toBe(url);
    expect(element.querySelector('h1')?.textContent).toBe(titre);
  });

  it('informe sur les prestataires et les purges sans les presenter comme deja executees', async () => {
    await router.navigateByUrl('/confidentialite');
    await fixture.whenStable();
    const texte = element.querySelector('main')?.textContent ?? '';
    for (const terme of [
      'Render',
      'Neon',
      'MongoDB Atlas',
      'Brevo',
      'six mois',
      'un an',
      'trois ans',
      'reprise d’activité',
      'pseudonymisés',
    ]) {
      expect(texte).toContain(terme);
    }
    expect(texte).toContain('ne constituent pas la preuve de leur exécution');
  });
});
