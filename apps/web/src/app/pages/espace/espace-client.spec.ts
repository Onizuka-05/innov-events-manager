import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ApiService } from '../../core/api.service';
import { AuthentificationService, type Utilisateur } from '../../core/authentification.service';
import { routes } from '../../app.routes';
import { AccueilClient } from './accueil-client';
import { EvenementsClient } from './evenements-client';
import { ProfilClientPage } from './profil-client';

const compte = {
  prenom: 'Léa',
  nom: 'Martin',
  nom_utilisateur: 'lea',
  email_connexion: 'lea@example.org',
};
const fiche = {
  entreprise: 'Test SAS',
  prenom_contact: 'Léa',
  nom_contact: 'Martin',
  email_contact: 'contact@example.org',
  telephone: '0600000000',
  adresse_postale: 'Paris',
};
const evenement = {
  id_evenement: '3',
  nom: 'Salon Aster',
  date_debut: '2027-01-20T09:00:00Z',
  date_fin: '2027-01-20T18:00:00Z',
  lieu: 'Lyon',
  statut_evenement: 'termine',
  libelle_type: 'Salon',
  date_accord_publication: null,
  visible_public: true,
  avis: null,
};
const accueil = {
  prochains_evenements: [{ ...evenement, statut_evenement: 'accepte' }],
  suivi: [
    {
      id_prospect: '7',
      date_demande: '2026-11-17T10:00:00Z',
      libelle_type: 'Salon',
      statut_prospect: 'converti',
      evenement: {
        id_evenement: '3',
        nom: 'Salon Aster',
        statut_evenement: 'accepte',
        devis: [
          {
            id_devis: '9',
            intitule: 'Formule essentielle',
            statut_devis: 'etude_client',
            date_envoi: '2026-11-17T12:00:00Z',
          },
        ],
      },
    },
  ],
};
function preparer(
  role: Utilisateur['role'] | null = 'client',
  reponses: Record<string, unknown> = {},
) {
  const utilisateur = signal<Utilisateur | null>(
    role ? { id_utilisateur: '2', role, ...compte } : null,
  );
  const restreinte = signal(false);
  const donnees: Record<string, unknown> = {
    '/profil': { compte, fiche },
    '/mes-evenements': [evenement],
    '/espace-client': accueil,
    '/devis': [],
    '/administration/tableau-de-bord': {
      prochains_evenements: [],
      notes_recentes: [],
      clients_actifs: [],
      brouillons: [],
    },
    ...reponses,
  };
  const api = {
    get: vi.fn(async (p: string): Promise<unknown> => structuredClone(donnees[p] ?? [])),
    modifier: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
  };
  const auth = { utilisateur, restreinte, charger: vi.fn(async () => undefined) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: ApiService, useValue: api },
      { provide: AuthentificationService, useValue: auth },
    ],
  });
  return { api, auth };
}
async function ouvrir<T>(composant: Type<T>, reponses: Record<string, unknown> = {}) {
  const donnees = preparer('client', reponses);
  const fixture = TestBed.createComponent(composant);
  await fixture.whenStable();
  fixture.detectChanges();
  return { ...donnees, fixture, el: fixture.nativeElement as HTMLElement };
}
function saisir(el: HTMLElement, selecteur: string, valeur: string) {
  const e = el.querySelector<HTMLInputElement>(selecteur)!;
  e.value = valeur;
  e.dispatchEvent(new Event('input', { bubbles: true }));
}
function cocher(el: HTMLElement, selecteur: string, coche = true) {
  const e = el.querySelector<HTMLInputElement>(selecteur)!;
  e.checked = coche;
  e.dispatchEvent(new Event('change', { bubbles: true }));
}
function soumettre(el: HTMLElement, selecteur: string) {
  el.querySelector(selecteur)!.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
}
const erreur = (status: number, message: string) =>
  new HttpErrorResponse({ status, error: { erreur: message } });

describe('Accueil et navigation du client', () => {
  it.each(['/espace', '/espace/devis', '/espace/evenements', '/espace/profil'])(
    'conserve quatre rubriques, un titre et la rubrique active sur %s',
    async (chemin) => {
      preparer();
      const h = await RouterTestingHarness.create(chemin);
      await h.fixture.whenStable();
      h.detectChanges();
      const el = h.routeNativeElement!;
      const liens = [...el.querySelectorAll('nav[aria-label="Espace client"] a')];
      expect(liens.map((a) => a.textContent?.trim())).toEqual([
        'Accueil',
        'Mes devis',
        'Mes événements',
        'Mon profil',
      ]);
      expect(
        liens
          .filter((a) => a.getAttribute('aria-current') === 'page')
          .map((a) => a.getAttribute('href')),
      ).toEqual([chemin]);
      expect(el.querySelectorAll('h1')).toHaveLength(1);
    },
  );
  it.each([
    ['admin', '/administration'],
    ['employe', '/administration/evenements'],
  ] as const)('renvoie %s vers son espace', async (role, destination) => {
    preparer(role);
    await RouterTestingHarness.create('/espace/profil');
    expect(TestBed.inject(Router).url).toBe(destination);
  });
  it('protege une rubrique et conserve la destination du visiteur', async () => {
    preparer(null);
    await RouterTestingHarness.create('/espace/evenements');
    expect(TestBed.inject(Router).url).toBe('/connexion?retour=%2Fespace%2Fevenements');
  });
  it('redirige les anciens liens de devis en conservant leurs parametres', async () => {
    preparer();
    await RouterTestingHarness.create('/devis?proposition=9');
    expect(TestBed.inject(Router).url).toBe('/espace/devis?proposition=9');
  });
  it('affiche le widget et les etapes des seules demandes renvoyees par le serveur', async () => {
    const { el, api } = await ouvrir(AccueilClient);
    expect(api.get).toHaveBeenCalledWith('/espace-client');
    for (const t of [
      'Salon Aster',
      'Demande reçue',
      'Prise en charge',
      'Formule essentielle',
      'Étude client',
    ])
      expect(el.textContent).toContain(t);
    expect(el.querySelectorAll('.etapes > li')).toHaveLength(4);
  });
  it('presente le cas sans fiche ni demande avec un lien pour demander un devis', async () => {
    const { el } = await ouvrir(AccueilClient, {
      '/espace-client': { prochains_evenements: [], suivi: [] },
    });
    expect(el.textContent).toContain('Aucune demande rattachée');
    expect(el.querySelector('a[href="/demande-devis"]')).not.toBeNull();
  });
  it('annonce le chargement puis une erreur de l accueil', async () => {
    const { api } = preparer();
    let terminer!: () => void;
    api.get.mockImplementationOnce(
      () =>
        new Promise((_r, rej) => {
          terminer = () => rej(erreur(503, 'Indisponible'));
        }),
    );
    const f = TestBed.createComponent(AccueilClient);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="status"]').textContent).toContain('Chargement');
    terminer();
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain('Indisponible');
  });
});

describe('Avis et publication dans Mes evenements', () => {
  it('affiche les evenements, l accord et les etiquettes du formulaire d avis', async () => {
    const { el } = await ouvrir(EvenementsClient);
    expect(el.textContent).toContain('Salon Aster');
    expect(el.querySelectorAll('input[type="radio"]')).toHaveLength(5);
    expect(el.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');
  });
  it('n affiche aucun formulaire d avis pour un evenement non termine ou deja evalue', async () => {
    const { el } = await ouvrir(EvenementsClient, {
      '/mes-evenements': [
        { ...evenement, statut_evenement: 'en_cours' },
        {
          ...evenement,
          id_evenement: '4',
          avis: { note_evaluation: 4, commentaire: 'Bien', statut_avis: 'valide' },
        },
      ],
    });
    expect(el.querySelectorAll('form')).toHaveLength(0);
    expect(el.textContent).toContain('4 sur 5');
    expect(el.textContent).toContain('Validé');
  });
  it('valide l avis avant l envoi puis affiche son statut de moderation', async () => {
    const { el, api, fixture } = await ouvrir(EvenementsClient);
    soumettre(el, 'form');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.modifier).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Choisissez une note');
    cocher(el, '#note-3-4');
    saisir(el, '#commentaire-3', '  Très bien organisé.  ');
    api.modifier.mockResolvedValueOnce({ statut_avis: 'en_attente' });
    soumettre(el, 'form');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.modifier).toHaveBeenCalledWith('POST', '/mes-evenements/3/avis', {
      note_evaluation: 4,
      commentaire: 'Très bien organisé.',
    });
    expect(el.textContent).toContain('En attente');
    expect(el.querySelector('form')).toBeNull();
  });
  it('garde le commentaire apres un refus du serveur', async () => {
    const { el, api, fixture } = await ouvrir(EvenementsClient);
    cocher(el, '#note-3-5');
    saisir(el, '#commentaire-3', 'Mon commentaire');
    api.modifier.mockRejectedValueOnce(erreur(409, 'Un avis existe déjà.'));
    soumettre(el, 'form');
    await fixture.whenStable();
    fixture.detectChanges();
    expect((el.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Mon commentaire');
    expect(el.textContent).toContain('Un avis existe déjà.');
  });
  it('evite le double envoi d un avis', async () => {
    const { el, api, fixture } = await ouvrir(EvenementsClient);
    cocher(el, '#note-3-4');
    saisir(el, '#commentaire-3', 'Bien');
    let terminer!: (v: unknown) => void;
    api.modifier.mockImplementationOnce(
      () =>
        new Promise((r) => {
          terminer = r;
        }),
    );
    soumettre(el, 'form');
    soumettre(el, 'form');
    expect(api.modifier).toHaveBeenCalledTimes(1);
    terminer({ statut_avis: 'en_attente' });
    await fixture.whenStable();
  });
  it('donne puis retire l accord et retablit le controle en cas d erreur', async () => {
    const { el, api, fixture } = await ouvrir(EvenementsClient);
    api.modifier.mockResolvedValueOnce({ date_accord_publication: '2026-11-17T13:00:00Z' });
    cocher(el, '#accord-3');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.modifier).toHaveBeenCalledWith('POST', '/mes-evenements/3/accord-publication');
    expect(el.textContent).toContain('Accord donné le');
    api.modifier.mockRejectedValueOnce(erreur(503, 'Réessayez.'));
    cocher(el, '#accord-3', false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect((el.querySelector('#accord-3') as HTMLInputElement).checked).toBe(true);
    api.modifier.mockResolvedValueOnce({ date_accord_publication: null });
    cocher(el, '#accord-3', false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.modifier).toHaveBeenCalledWith('DELETE', '/mes-evenements/3/accord-publication');
    expect(el.textContent).toContain('Accord retiré');
  });
  it('presente le cas vide et une erreur de chargement', async () => {
    const { el } = await ouvrir(EvenementsClient, { '/mes-evenements': [] });
    expect(el.textContent).toContain('Aucun événement rattaché');
    TestBed.resetTestingModule();
    const { api } = preparer();
    api.get.mockRejectedValueOnce(erreur(503, 'Événements indisponibles'));
    const f = TestBed.createComponent(EvenementsClient);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Événements indisponibles',
    );
  });
});

describe('Profil et effacement du compte', () => {
  it('efface le message de mot de passe quand l e-mail change et revient a sa valeur initiale', async () => {
    const { el, api, fixture } = await ouvrir(ProfilClientPage);
    saisir(el, '#compte-email_connexion', 'nouveau@example.org');
    soumettre(el, 'form[aria-describedby="erreur-compte"]');
    fixture.detectChanges();
    expect(el.textContent).toContain('Saisissez votre mot de passe actuel');
    saisir(el, '#compte-email_connexion', compte.email_connexion);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Saisissez votre mot de passe actuel');
    expect(el.querySelector('#mot-actuel')).toBeNull();
    expect(api.modifier).not.toHaveBeenCalled();
  });
  it('separe compte et fiche et masque la fiche si elle est absente', async () => {
    const { el } = await ouvrir(ProfilClientPage, { '/profil': { compte, fiche: null } });
    expect(el.querySelector('#compte-prenom')).not.toBeNull();
    expect(el.querySelector('#fiche-entreprise')).toBeNull();
    expect(el.textContent).toContain('Aucune fiche');
  });
  it('valide le compte et ne demande le mot de passe que pour un nouvel e-mail', async () => {
    const { el, api, fixture, auth } = await ouvrir(ProfilClientPage);
    expect(el.querySelector('#mot-actuel')).toBeNull();
    saisir(el, '#compte-prenom', '');
    soumettre(el, 'form[aria-describedby="erreur-compte"]');
    expect(api.modifier).not.toHaveBeenCalled();
    saisir(el, '#compte-prenom', 'Camille');
    api.modifier.mockResolvedValueOnce({ compte: { ...compte, prenom: 'Camille' }, fiche });
    soumettre(el, 'form[aria-describedby="erreur-compte"]');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.modifier).toHaveBeenCalledWith('PATCH', '/profil', {
      compte: { ...compte, prenom: 'Camille' },
    });
    expect(auth.utilisateur()?.prenom).toBe('Camille');
    saisir(el, '#compte-email_connexion', 'nouveau@example.org');
    fixture.detectChanges();
    expect(el.querySelector('#mot-actuel')).not.toBeNull();
    soumettre(el, 'form[aria-describedby="erreur-compte"]');
    fixture.detectChanges();
    expect(el.textContent).toContain('Saisissez votre mot de passe actuel');
    expect(api.modifier).toHaveBeenCalledTimes(1);
    saisir(el, '#mot-actuel', 'Valide1!');
    api.modifier.mockResolvedValueOnce({
      compte: { ...compte, prenom: 'Camille', email_connexion: 'nouveau@example.org' },
      fiche,
    });
    soumettre(el, 'form[aria-describedby="erreur-compte"]');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.modifier).toHaveBeenLastCalledWith('PATCH', '/profil', {
      compte: { ...compte, prenom: 'Camille', email_connexion: 'nouveau@example.org' },
      mot_de_passe_actuel: 'Valide1!',
    });
  });
  it('transmet un bloc fiche complet et affiche les erreurs du serveur', async () => {
    const { el, api, fixture } = await ouvrir(ProfilClientPage);
    saisir(el, '#fiche-telephone', '0700000000');
    api.modifier.mockResolvedValueOnce({ compte, fiche: { ...fiche, telephone: '0700000000' } });
    soumettre(el, 'form[aria-describedby="erreur-fiche"]');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.modifier).toHaveBeenCalledWith('PATCH', '/profil', {
      fiche: { ...fiche, telephone: '0700000000' },
    });
    api.modifier.mockRejectedValueOnce(erreur(409, 'Cette valeur est déjà utilisée.'));
    soumettre(el, 'form[aria-describedby="erreur-compte"]');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Cette valeur est déjà utilisée.');
  });
  it('affiche l e-mail du contact en lecture seule, gere par Innov Events', async () => {
    const { el } = await ouvrir(ProfilClientPage);
    const champ = el.querySelector<HTMLInputElement>('#fiche-email_contact')!;
    expect(champ.readOnly).toBe(true);
    expect(champ.value).toBe(fiche.email_contact);
    expect(el.querySelector('#aide-fiche-email_contact')?.textContent).toContain(
      'Adresse gérée par Innov’Events',
    );
    expect(el.querySelector<HTMLInputElement>('#fiche-telephone')!.readOnly).toBe(false);
  });
  it('exige mot de passe et confirmation avant la suppression', async () => {
    const { el, api } = await ouvrir(ProfilClientPage);
    saisir(el, '#mot-suppression', 'Valide1!');
    soumettre(el, 'form[aria-describedby="erreur-suppression"]');
    expect(api.modifier).not.toHaveBeenCalled();
  });
  it('efface l etat de connexion apres succes puis revient a l accueil avec le message', async () => {
    const { el, api, fixture, auth } = await ouvrir(ProfilClientPage);
    saisir(el, '#mot-suppression', 'Valide1!');
    cocher(el, '#confirmation-suppression');
    soumettre(el, 'form[aria-describedby="erreur-suppression"]');
    await fixture.whenStable();
    expect(api.modifier).toHaveBeenCalledWith('DELETE', '/profil', { mot_de_passe: 'Valide1!' });
    expect(auth.utilisateur()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/?compte_supprime=1');
  });
  it('conserve compte, session et formulaire sur le 503 d effacement indisponible', async () => {
    const { el, api, fixture, auth } = await ouvrir(ProfilClientPage);
    saisir(el, '#mot-suppression', 'Valide1!');
    cocher(el, '#confirmation-suppression');
    api.modifier.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 503,
        error: {
          code: 'EFFACEMENT_INDISPONIBLE',
          erreur:
            'La suppression du compte est momentanément impossible. Réessayez dans quelques minutes.',
        },
      }),
    );
    soumettre(el, 'form[aria-describedby="erreur-suppression"]');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(auth.utilisateur()).not.toBeNull();
    expect(el.textContent).toContain('momentanément impossible');
    expect((el.querySelector('#mot-suppression') as HTMLInputElement).value).toBe('Valide1!');
    expect((el.querySelector('button.bouton-danger') as HTMLButtonElement).disabled).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/');
  });
  it('affiche une erreur si le profil ne se charge pas', async () => {
    const { api } = preparer();
    api.get.mockRejectedValueOnce(erreur(503, 'Profil indisponible'));
    const f = TestBed.createComponent(ProfilClientPage);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Profil indisponible',
    );
  });
  it('annonce la suppression sur la page d accueil publique', async () => {
    preparer(null);
    const h = await RouterTestingHarness.create('/?compte_supprime=1');
    expect(h.routeNativeElement!.querySelector('[role="status"]')?.textContent).toContain(
      'Votre compte a été supprimé.',
    );
  });
});
