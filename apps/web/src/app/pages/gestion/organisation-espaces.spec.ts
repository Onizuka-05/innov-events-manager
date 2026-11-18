import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { routes } from '../../app.routes';
import { ApiService } from '../../core/api.service';
import { AuthentificationService, type Utilisateur } from '../../core/authentification.service';

const prospectInitial = {
  id_prospect: '7',
  entreprise: 'Test SAS',
  nom: 'Martin',
  prenom: 'Léa',
  email: 'lea@example.org',
  telephone: '0600000000',
  date_souhaitee: '2027-01-20',
  statut_prospect: 'a_contacter',
  id_client: null as string | null,
  id_type_evenement: 2,
  lieu_souhaite: 'Lyon',
};
const client = {
  id_client: '2',
  entreprise: 'Test SAS',
  nom_contact: 'Martin',
  email_contact: 'lea@example.org',
  adresse_postale: '10 rue du Test, Lyon',
};
const tableau = {
  prochains_evenements: [],
  notes_recentes: [],
  clients_actifs: [],
  brouillons: [],
};
const rubriques = [
  ['', 'Tableau de bord'],
  ['prospects', 'Prospects'],
  ['clients', 'Clients'],
  ['evenements', 'Événements'],
  ['devis', 'Devis'],
  ['taches', 'Tâches'],
  ['avis', 'Avis'],
  ['comptes', 'Comptes'],
  ['journaux', 'Journaux'],
  ['parametres', 'Paramètres'],
];
function preparer(role: Utilisateur['role'] | null = 'admin', revient = false) {
  const compte: Utilisateur = {
    id_utilisateur: '1',
    email_connexion: 'test@example.org',
    nom_utilisateur: 'test',
    prenom: 'Test',
    nom: 'Martin',
    role: role ?? 'client',
  };
  const utilisateur = signal<Utilisateur | null>(role ? compte : null);
  const prospect = { ...prospectInitial };
  const get = vi.fn(async (p: string): Promise<unknown> => {
    if (p === '/prospects') return [{ ...prospect }];
    if (p === '/clients') return revient || prospect.id_client ? [client] : [];
    if (p === '/types-evenement') return [{ id_type_evenement: 2, libelle: 'Salon' }];
    if (p === '/administration/tableau-de-bord') return tableau;
    if (p === '/parametres/remerciement') return { texte_remerciement: 'Merci' };
    return [];
  });
  const modifier = vi.fn(async (_m: string, p: string) => {
    if (p === '/prospects/7/conversion') {
      prospect.statut_prospect = 'converti';
      prospect.id_client = '2';
      return { id_client: '2', cree: !revient };
    }
    return {};
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: ApiService, useValue: { get, modifier } },
      {
        provide: AuthentificationService,
        useValue: {
          utilisateur,
          restreinte: () => false,
          charger: async () => undefined,
          connecter: async () => utilisateur.set(compte),
        },
      },
    ],
  });
  return { get, modifier, utilisateur, compte };
}
function champ(h: RouterTestingHarness, id: string, valeur: string) {
  const e = h.routeNativeElement!.querySelector<HTMLInputElement>('#' + id)!;
  e.value = valeur;
  e.dispatchEvent(new Event('input', { bubbles: true }));
}
async function soumettre(h: RouterTestingHarness, selecteur: string) {
  h.detectChanges();
  h.routeNativeElement!.querySelector(selecteur)!.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
  await h.fixture.whenStable();
  h.detectChanges();
}
describe('Organisation des espaces', () => {
  it.each(rubriques)(
    'garde le menu, un seul h1 et le titre de la rubrique %s',
    async (chemin, titre) => {
      preparer();
      const h = await RouterTestingHarness.create();
      await h.navigateByUrl('/administration' + (chemin ? '/' + chemin : ''));
      await h.fixture.whenStable();
      h.detectChanges();
      const nav = h.routeNativeElement!.querySelector('nav[aria-label="Espace équipe"]')!;
      expect(nav.querySelectorAll('a')).toHaveLength(10);
      expect(nav.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
      expect(nav.querySelector('a[aria-current="page"]')!.textContent?.trim()).toBe(titre);
      expect(h.routeNativeElement!.querySelectorAll('h1')).toHaveLength(1);
      expect(TestBed.inject(Title).getTitle()).toBe(titre + " | Innov'Events");
    },
  );
  it('limite le menu employe a quatre rubriques', async () => {
    preparer('employe');
    const h = await RouterTestingHarness.create('/administration/evenements');
    const liens = [...h.routeNativeElement!.querySelectorAll('nav[aria-label="Espace équipe"] a')];
    expect(liens.map((a) => a.textContent?.trim())).toEqual([
      'Clients',
      'Événements',
      'Mes tâches',
      'Avis',
    ]);
  });
  it('ne montre aucun menu equipe au client', async () => {
    preparer('client');
    const h = await RouterTestingHarness.create('/espace');
    expect(h.routeNativeElement!.querySelector('nav[aria-label="Espace équipe"]')).toBeNull();
    expect(h.routeNativeElement!.querySelector('a[href^="/administration"]')).toBeNull();
  });
  it.each(['', 'prospects', 'devis', 'comptes', 'journaux', 'parametres'])(
    'renvoie l’employe depuis la rubrique admin %s',
    async (rubrique) => {
      const { get } = preparer('employe');
      const h = await RouterTestingHarness.create();
      await h.navigateByUrl('/administration' + (rubrique ? '/' + rubrique : ''));
      expect(TestBed.inject(Router).url).toBe('/administration/evenements');
      expect(get).not.toHaveBeenCalledWith('/comptes');
      expect(get).not.toHaveBeenCalledWith('/prospects');
    },
  );
  it.each([
    ['admin', '/administration'],
    ['employe', '/administration/evenements'],
    ['client', '/espace'],
  ] as const)('ouvre l’accueil %s apres connexion', async (role, destination) => {
    const { utilisateur, compte } = preparer(role);
    utilisateur.set(null);
    compte.role = role;
    const h = await RouterTestingHarness.create('/connexion');
    champ(h, 'email_connexion', 'test@example.org');
    champ(h, 'mot_de_passe', 'Valide1!');
    await soumettre(h, 'form');
    expect(TestBed.inject(Router).url).toBe(destination);
  });
  it.each([
    ['admin', '/administration'],
    ['employe', '/administration/evenements'],
  ] as const)('redirige /espace pour %s', async (role, destination) => {
    preparer(role);
    await RouterTestingHarness.create('/espace');
    expect(TestBed.inject(Router).url).toBe(destination);
  });
  it('conserve la destination equipe demandee avant connexion', async () => {
    const { utilisateur } = preparer('employe');
    utilisateur.set(null);
    const h = await RouterTestingHarness.create('/administration/clients');
    expect(TestBed.inject(Router).url).toBe('/connexion?retour=%2Fadministration%2Fclients');
    champ(h, 'email_connexion', 'test@example.org');
    champ(h, 'mot_de_passe', 'Valide1!');
    await soumettre(h, 'form');
    expect(TestBed.inject(Router).url).toBe('/administration/clients');
  });
  it.each([
    ['admin', '/administration/devis'],
    ['employe', '/administration/evenements'],
    ['client', '/espace/devis'],
  ] as const)('reserve /devis au client et redirige %s', async (role, destination) => {
    const { get } = preparer(role);
    const h = await RouterTestingHarness.create('/devis');
    expect(TestBed.inject(Router).url).toBe(destination);
    if (role === 'employe') expect(get).not.toHaveBeenCalledWith('/devis');
    if (role === 'client')
      expect(h.routeNativeElement!.querySelector('h1')!.textContent).toBe('Mes devis');
  });
  it('redirige le message de remerciement vers Parametres', async () => {
    preparer();
    await RouterTestingHarness.create('/administration/remerciement');
    expect(TestBed.inject(Router).url).toBe('/administration/parametres');
  });
  it('conserve les anciennes adresses equipe et l’identifiant de fiche', async () => {
    preparer('employe');
    await RouterTestingHarness.create('/equipe/evenements?id=3');
    expect(TestBed.inject(Router).url).toBe('/administration/evenements?id=3');
  });
  it.each([false, true])(
    'convertit puis relit et preremplit l’evenement (client existant=%s)',
    async (revient) => {
      const { get, modifier } = preparer('admin', revient);
      const stockage = vi.spyOn(Storage.prototype, 'setItem');
      const h = await RouterTestingHarness.create('/administration/prospects');
      await h.fixture.whenStable();
      h.detectChanges();
      h.routeNativeElement!.querySelector<HTMLButtonElement>(
        'button[aria-label="Convertir en client : Test SAS"]',
      )!.click();
      await h.fixture.whenStable();
      h.detectChanges();
      const adresse = h.routeNativeElement!.querySelector<HTMLInputElement>('#adresse')!;
      expect(adresse.required).toBe(true);
      const bouton = () =>
        h.routeNativeElement!.querySelector<HTMLButtonElement>(
          'section[aria-labelledby="titre-conversion"] button[type="submit"]',
        )!;
      if (revient) {
        expect(adresse.value).toBe(client.adresse_postale);
        expect(h.routeNativeElement!.textContent).toContain('Client existant avec cet e-mail');
        // Rattachement a une fiche existante : seulement apres confirmation explicite.
        expect(bouton().disabled).toBe(true);
        await soumettre(h, 'section[aria-labelledby="titre-conversion"] form');
        expect(modifier).not.toHaveBeenCalled();
        const confirmation = h.routeNativeElement!.querySelector<HTMLInputElement>(
          '#confirmation-rattachement',
        )!;
        expect(confirmation.labels![0]!.textContent).toContain(client.entreprise);
        confirmation.click();
        await h.fixture.whenStable();
        h.detectChanges();
        expect(bouton().disabled).toBe(false);
      } else {
        expect(h.routeNativeElement!.querySelector('#confirmation-rattachement')).toBeNull();
        champ(h, 'adresse', client.adresse_postale);
      }
      await soumettre(h, 'section[aria-labelledby="titre-conversion"] form');
      expect(modifier).toHaveBeenCalledWith('POST', '/prospects/7/conversion', {
        adresse_postale: client.adresse_postale,
        id_client_confirme: revient ? client.id_client : null,
      });
      expect(TestBed.inject(Router).url).toBe('/administration/devis?prospect=7');
      expect(get.mock.calls.filter(([p]) => p === '/prospects')).toHaveLength(2);
      expect(h.routeNativeElement!.querySelector<HTMLInputElement>('#nom')!.value).toBe(
        'Événement Test SAS',
      );
      expect(h.routeNativeElement!.querySelector<HTMLInputElement>('#lieu')!.value).toBe('Lyon');
      expect(h.routeNativeElement!.querySelector<HTMLInputElement>('#debut')!.value).toBe(
        '2027-01-20T09:00',
      );
      expect(h.routeNativeElement!.querySelector<HTMLSelectElement>('#client')!.value).toBe('2');
      expect(stockage).not.toHaveBeenCalled();
      stockage.mockRestore();
      await h.navigateByUrl('/administration/clients');
      await h.navigateByUrl('/administration/devis?prospect=7');
      await h.fixture.whenStable();
      h.detectChanges();
      expect(h.routeNativeElement!.querySelector<HTMLInputElement>('#nom')!.value).toBe(
        'Événement Test SAS',
      );
    },
  );
  it('relit les fiches et redemande la confirmation si la fiche a rattacher a change', async () => {
    const { get, modifier } = preparer('admin', true);
    modifier.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 409,
        error: {
          erreur: 'La fiche à laquelle rattacher la demande a changé : rechargez la page.',
          code: 'RATTACHEMENT_A_CONFIRMER',
        },
      }),
    );
    const h = await RouterTestingHarness.create('/administration/prospects');
    await h.fixture.whenStable();
    h.detectChanges();
    h.routeNativeElement!.querySelector<HTMLButtonElement>(
      'button[aria-label="Convertir en client : Test SAS"]',
    )!.click();
    await h.fixture.whenStable();
    h.detectChanges();
    h.routeNativeElement!.querySelector<HTMLInputElement>('#confirmation-rattachement')!.click();
    await h.fixture.whenStable();
    await soumettre(h, 'section[aria-labelledby="titre-conversion"] form');
    expect(TestBed.inject(Router).url).toBe('/administration/prospects');
    expect(get.mock.calls.filter(([p]) => p === '/clients')).toHaveLength(2);
    expect(h.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain(
      'a changé',
    );
    expect(
      h.routeNativeElement!.querySelector<HTMLInputElement>('#confirmation-rattachement')!.checked,
    ).toBe(false);
  });
  it('annule la confirmation si la fiche affichee change apres un classement sans suite', async () => {
    const { get, modifier } = preparer('admin', true);
    const base = get.getMockImplementation()!;
    const autre = { ...prospectInitial, id_prospect: '8', entreprise: 'Autre SARL' };
    let fiches = [client];
    get.mockImplementation(async (p: string) => {
      if (p === '/prospects') return [{ ...prospectInitial }, autre];
      if (p === '/clients') return fiches;
      return base(p);
    });
    const h = await RouterTestingHarness.create('/administration/prospects');
    await h.fixture.whenStable();
    h.detectChanges();
    const element = <T extends Element>(selecteur: string) =>
      h.routeNativeElement!.querySelector<T>(selecteur)!;
    const conversion = 'section[aria-labelledby="titre-conversion"] form';
    const bouton = () => element<HTMLButtonElement>(conversion + ' button[type="submit"]');
    const caseConfirmation = () => element<HTMLInputElement>('#confirmation-rattachement');
    element<HTMLButtonElement>('button[aria-label="Convertir en client : Test SAS"]').click();
    await h.fixture.whenStable();
    h.detectChanges();
    caseConfirmation().click();
    await h.fixture.whenStable();
    h.detectChanges();
    expect(bouton().disabled).toBe(false);
    // Alpha effacee entre-temps : Beta devient la seule fiche a cette adresse.
    fiches = [{ ...client, id_client: '3', entreprise: 'Beta SAS' }];
    element<HTMLButtonElement>('button[aria-label="Classer sans suite : Autre SARL"]').click();
    await h.fixture.whenStable();
    h.detectChanges();
    champ(h, 'message-echec', 'Merci pour votre demande.');
    await soumettre(h, 'form.panneau');
    expect(modifier).toHaveBeenCalledWith('POST', '/prospects/8/echec', {
      message: 'Merci pour votre demande.',
    });
    expect(get.mock.calls.filter(([p]) => p === '/clients')).toHaveLength(2);
    expect(caseConfirmation().checked).toBe(false);
    expect(caseConfirmation().labels![0]!.textContent).toContain('Beta SAS');
    expect(bouton().disabled).toBe(true);
    await soumettre(h, conversion);
    expect(modifier).not.toHaveBeenCalledWith('POST', '/prospects/7/conversion', expect.anything());
    caseConfirmation().click();
    await h.fixture.whenStable();
    await soumettre(h, conversion);
    expect(modifier).toHaveBeenCalledWith('POST', '/prospects/7/conversion', {
      adresse_postale: client.adresse_postale,
      id_client_confirme: '3',
    });
  });
  it('refuse de preremplir un evenement depuis une demande non convertie', async () => {
    preparer();
    const h = await RouterTestingHarness.create('/administration/devis?prospect=7');
    await h.fixture.whenStable();
    h.detectChanges();
    expect(h.routeNativeElement!.querySelector<HTMLInputElement>('#nom')!.value).toBe('');
    expect(h.routeNativeElement!.querySelector('[role="alert"]')!.textContent).toContain(
      'introuvable',
    );
  });
  it.each(['employe', 'admin'] as const)('liste les taches selon le compte %s', async (role) => {
    const { get } = preparer(role);
    const tache = {
      id_tache: '11',
      id_utilisateur: '1',
      id_evenement: '3',
      titre: 'Préparer le salon',
      description: 'Vérifier la salle',
      statut_tache: 'a_faire',
      date_echeance: null,
      prenom: 'Test',
      nom: 'Martin',
    };
    get.mockImplementation(async (p: string) => {
      if (p === '/evenements') return [{ id_evenement: '3' }, { id_evenement: '4' }];
      if (p === '/evenements/3')
        return {
          taches: [
            tache,
            { ...tache, id_tache: '12', id_utilisateur: '2', titre: 'Tâche d’un autre employé' },
          ],
        };
      if (p === '/evenements/4')
        return {
          taches: [{ ...tache, id_tache: '13', id_evenement: '4', titre: 'Accueillir le client' }],
        };
      return [];
    });
    const h = await RouterTestingHarness.create('/administration/taches');
    await h.fixture.whenStable();
    h.detectChanges();
    expect(get).toHaveBeenCalledWith('/evenements');
    expect(get).toHaveBeenCalledWith('/evenements/3');
    expect(get).toHaveBeenCalledWith('/evenements/4');
    const titres = [...h.routeNativeElement!.querySelectorAll('article h2')].map((titre) =>
      titre.textContent?.trim(),
    );
    expect(titres).toContain('Préparer le salon');
    expect(titres).toContain('Accueillir le client');
    if (role === 'employe') {
      expect(titres).toHaveLength(2);
      expect(h.routeNativeElement!.textContent).not.toContain('Tâche d’un autre employé');
    } else {
      expect(titres).toHaveLength(3);
      expect(titres).toContain('Tâche d’un autre employé');
    }
    expect(h.routeNativeElement!.querySelector('article a')!.getAttribute('href')).toBe(
      '/administration/evenements?id=3',
    );
  });
});
