import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { ApiService } from '../../core/api.service';
import { AuthentificationService, type Utilisateur } from '../../core/authentification.service';
import { routes } from '../../app.routes';

describe('Parcours de connexion', () => {
  const admin: Utilisateur = {
    id_utilisateur: '1',
    email_connexion: 'chloe@example.org',
    nom_utilisateur: 'chloe',
    prenom: 'Chloé',
    nom: 'Martin',
    role: 'admin',
  };
  const utilisateur = signal<Utilisateur | null>(null);
  const restreinte = signal(false);
  let temporaire: boolean;
  let connecter: ReturnType<typeof vi.fn>;
  let modifier: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    utilisateur.set(null);
    restreinte.set(false);
    temporaire = false;
    connecter = vi.fn(async () => {
      restreinte.set(temporaire);
      utilisateur.set(temporaire ? null : admin);
    });
    modifier = vi.fn(async () => {
      restreinte.set(false);
      utilisateur.set(admin);
      return { message: 'Enregistré' };
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthentificationService,
          useValue: {
            utilisateur,
            restreinte,
            connecter,
            charger: () => Promise.resolve(),
            deconnecter: async () => {
              utilisateur.set(null);
              restreinte.set(false);
            },
          },
        },
        {
          provide: ApiService,
          useValue: { modifier, get: async () => ({ texte_remerciement: 'Merci' }) },
        },
      ],
    });
  });
  function saisir(h: RouterTestingHarness, id: string, valeur: string) {
    const input = h.routeNativeElement!.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = valeur;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  async function envoyer(h: RouterTestingHarness) {
    h.detectChanges();
    h.routeNativeElement!.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await h.fixture.whenStable();
  }

  it('retrouve l’action demandee apres la connexion normale', async () => {
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/connexion?retour=%2Fadministration%2Fremerciement');
    saisir(h, 'email_connexion', admin.email_connexion);
    saisir(h, 'mot_de_passe', 'Valide1!');
    await envoyer(h);
    expect(connecter).toHaveBeenCalledWith({
      email_connexion: admin.email_connexion,
      mot_de_passe: 'Valide1!',
    });
    expect(TestBed.inject(Router).url).toBe('/administration/remerciement');
  });
  it('passe d’abord par le renouvellement avec la destination conservee', async () => {
    temporaire = true;
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/connexion?retour=%2Fadministration%2Fremerciement');
    saisir(h, 'email_connexion', admin.email_connexion);
    saisir(h, 'mot_de_passe', 'Temporaire1!');
    await envoyer(h);
    expect(TestBed.inject(Router).url).toBe(
      '/nouveau-mot-de-passe?retour=%2Fadministration%2Fremerciement',
    );
    saisir(h, 'mot_de_passe', 'Nouveau1!');
    await envoyer(h);
    expect(modifier).toHaveBeenCalledWith('PATCH', '/mot-de-passe', { mot_de_passe: 'Nouveau1!' });
    expect(TestBed.inject(Router).url).toBe('/administration/remerciement');
  });
  it('permet d’abandonner la session temporaire avant un nouvel oubli', async () => {
    restreinte.set(true);
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/nouveau-mot-de-passe');
    h.routeNativeElement!.querySelector<HTMLButtonElement>('button[type=button]')!.click();
    await h.fixture.whenStable();
    expect(restreinte()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/mot-de-passe-oublie');
  });

  it('conserve la destination pendant le detour par le mot de passe oublie', async () => {
    temporaire = true;
    const destination = '?retour=%2Fadministration%2Fremerciement';
    const router = TestBed.inject(Router);
    const h = await RouterTestingHarness.create();
    const lien = (texte: string) =>
      [...h.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('a')].find((a) =>
        a.textContent?.includes(texte),
      )!;
    await h.navigateByUrl(`/connexion${destination}`);
    expect(lien('Créer un compte').getAttribute('href')).toBe(`/inscription${destination}`);
    lien('Mot de passe oublié').click();
    await h.fixture.whenStable();
    h.detectChanges();
    expect(router.url).toBe(`/mot-de-passe-oublie${destination}`);
    lien('Revenir à la connexion').click();
    await h.fixture.whenStable();
    h.detectChanges();
    expect(router.url).toBe(`/connexion${destination}`);
    saisir(h, 'email_connexion', admin.email_connexion);
    saisir(h, 'mot_de_passe', 'Temporaire1!');
    await envoyer(h);
    expect(router.url).toBe(`/nouveau-mot-de-passe${destination}`);
    saisir(h, 'mot_de_passe', 'Nouveau1!');
    await envoyer(h);
    expect(router.url).toBe('/administration/remerciement');
  });
  it('conserve la destination quand la session temporaire est abandonnee', async () => {
    restreinte.set(true);
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/nouveau-mot-de-passe?retour=%2Fadministration%2Fremerciement');
    h.routeNativeElement!.querySelector<HTMLButtonElement>('button[type=button]')!.click();
    await h.fixture.whenStable();
    expect(restreinte()).toBe(false);
    expect(TestBed.inject(Router).url).toBe(
      '/mot-de-passe-oublie?retour=%2Fadministration%2Fremerciement',
    );
  });
});
