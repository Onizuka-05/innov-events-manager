import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { ApiService } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';
import { TableauDeBord } from './tableau-de-bord';
import { Clients } from './clients';
import { EvenementsGestion } from './evenements';
import { NotesTaches } from './notes-taches';
import { Moderation } from './moderation';
import { Comptes } from './comptes';
import { Prospects } from './prospects';
import { Devis } from '../devis/devis';
import { Journaux, detailsLisibles } from './journaux';
import { Taches } from './taches';
import type { Type } from '@angular/core';

const evenement = {
  id_evenement: '3',
  id_client: '2',
  id_type_evenement: 1,
  id_theme: null,
  nom: 'Salon',
  date_debut: '2027-01-01T09:00:00+00:00',
  date_fin: '2027-01-01T18:00:00+00:00',
  lieu: 'Lyon',
  statut_evenement: 'accepte',
  entreprise: 'Test SAS',
  notes: [],
  taches: [],
  image_url: null,
  visible_public: false,
};
const client = {
  id_client: '2',
  entreprise: 'Test SAS',
  nom_contact: 'Martin',
  prenom_contact: 'Lea',
  email_contact: 'lea@example.org',
  telephone: '0600000000',
  adresse_postale: 'Lyon',
  date_anonymisation: null,
  evenements: [evenement],
};
const utilisateur = {
  id_utilisateur: '1',
  prenom: 'Ada',
  nom: 'Martin',
  role: 'employe',
  statut_compte: 'actif',
  email_connexion: 'ada@example.org',
};
function preparer<T>(composant: Type<T>, role = 'admin', reponses: Record<string, unknown> = {}) {
  const api = {
    get: vi.fn(async (p: string) => reponses[p] ?? []),
    modifier: vi.fn(async () => ({ id_client: '2' })),
  };
  TestBed.configureTestingModule({
    imports: [composant],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      {
        provide: AuthentificationService,
        useValue: { utilisateur: () => ({ ...utilisateur, role }) },
      },
    ],
  });
  return { api, fixture: TestBed.createComponent(composant) };
}
describe('espaces de gestion', () => {
  it('conserve les notes sur le tableau de bord sans la liste des prospects', async () => {
    const { fixture } = preparer(TableauDeBord, 'admin', {
      '/administration/tableau-de-bord': {
        prochains_evenements: [evenement],
        notes_recentes: [],
        clients_actifs: [client],
        brouillons: [],
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const t = fixture.nativeElement.textContent;
    for (const titre of [
      '3 prochains événements',
      '5 notes récentes',
      'Clients actifs (1)',
      'Événements en brouillon',
      'Notes globales',
    ])
      expect(t).toContain(titre);
    expect(fixture.nativeElement.querySelector('app-prospects')).toBeNull();
  });
  it('recherche un client et montre son historique sans edition employe', async () => {
    const { fixture, api } = preparer(Clients, 'employe', {
      '/clients?recherche=': [client],
      '/clients?recherche=Martin': [client],
      '/clients/2': client,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#recherche-client') as HTMLInputElement;
    input.value = 'Martin';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(api.get).toHaveBeenCalledWith('/clients?recherche=Martin');
    const bouton = [
      ...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>),
    ].find((b) => b.textContent?.includes('Test SAS'))!;
    bouton.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Historique des événements');
    expect(fixture.nativeElement.textContent).toContain('Salon');
    expect(fixture.nativeElement.textContent).not.toContain('Modifier la fiche');
  });
  it('cree une fiche avec les champs du contrat API', async () => {
    const { fixture, api } = preparer(Clients, 'admin', { '/clients/2': client });
    await fixture.whenStable();
    fixture.detectChanges();
    [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)]
      .find((b) => b.textContent?.includes('Créer un client'))!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    const donnees = {
      entreprise: 'Test SAS',
      nom_contact: 'Martin',
      prenom_contact: 'Lea',
      email_contact: 'lea@example.org',
      telephone: '0600000000',
      adresse_postale: 'Lyon',
    };
    for (const [k, v] of Object.entries(donnees)) {
      const i = fixture.nativeElement.querySelector('#client-' + k) as HTMLInputElement;
      i.value = v;
      i.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    const forms = fixture.nativeElement.querySelectorAll('form');
    forms[forms.length - 1].dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(api.modifier).toHaveBeenCalledWith('POST', '/clients', donnees);
  });
  it('ne propose pas de modification structurelle a l’employe sur un evenement', async () => {
    const { fixture } = preparer(EvenementsGestion, 'employe', {
      '/evenements': [evenement],
      '/evenements/3': evenement,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Notes du projet');
    expect(fixture.nativeElement.textContent).not.toContain('Modifier l’événement');
    expect(fixture.nativeElement.textContent).not.toContain("Modifier l'événement");
  });
  it('ne montre pas la progression de la tache d’un autre compte meme a l’admin', async () => {
    const { fixture } = preparer(NotesTaches);
    fixture.componentRef.setInput('id_evenement', '3');
    fixture.componentRef.setInput('taches', [
      { id_tache: '7', id_utilisateur: '9', titre: 'Autre', statut_tache: 'a_faire' },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Démarrer');
  });
  it('demarre sa propre tache en conservant les noms SQL dans le JSON', async () => {
    const { fixture, api } = preparer(NotesTaches, 'employe');
    fixture.componentRef.setInput('id_evenement', '3');
    fixture.componentRef.setInput('taches', [
      { id_tache: '7', id_utilisateur: '1', titre: 'Travail', statut_tache: 'a_faire' },
    ]);
    fixture.detectChanges();
    [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)]
      .find((b) => b.textContent?.trim() === 'Démarrer')!
      .click();
    await fixture.whenStable();
    expect(api.modifier).toHaveBeenCalledWith('POST', '/taches/7/statut', {
      statut_tache: 'en_cours',
    });
  });
  it('reinitialise les formulaires au changement d’evenement et cree la note sur le nouveau projet', async () => {
    const { fixture, api } = preparer(NotesTaches);
    fixture.componentRef.setInput('id_evenement', '3');
    fixture.componentRef.setInput('comptes', [utilisateur]);
    fixture.componentRef.setInput('notes', [
      {
        id_note: '11',
        id_evenement: '3',
        id_utilisateur: '1',
        contenu: 'Note du projet A',
        date_creation: '2027-01-01T09:00:00+00:00',
        prenom: 'Ada',
        nom: 'Martin',
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)]
      .find((b) => b.textContent?.trim() === 'Modifier la note')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#contenu-note-3').value).toBe('Note du projet A');

    const remplir = (selecteur: string, valeur: string, evenement = 'input') => {
      const champ = fixture.nativeElement.querySelector(selecteur) as
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      champ.value = valeur;
      champ.dispatchEvent(new Event(evenement));
    };
    remplir('#titre-tache', 'Tâche du projet A');
    remplir('#description-tache', 'Brouillon du projet A');
    remplir('#affectation-tache', '1', 'change');
    remplir('#echeance-tache', '2027-01-02T10:00');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('id_evenement', '4');
    fixture.componentRef.setInput('notes', []);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    for (const selecteur of [
      '#contenu-note-4',
      '#titre-tache',
      '#description-tache',
      '#affectation-tache',
      '#echeance-tache',
    ])
      expect(fixture.nativeElement.querySelector(selecteur).value, selecteur).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('Annuler la modification');

    remplir('#contenu-note-4', 'Note du projet B');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(api.modifier).toHaveBeenCalledExactlyOnceWith('POST', '/notes', {
      id_evenement: '4',
      contenu: 'Note du projet B',
    });
    expect(api.modifier).not.toHaveBeenCalledWith('PATCH', '/notes/11', expect.anything());
  });
  it('envoie la validation d’un avis', async () => {
    const { fixture, api } = preparer(Moderation, 'employe', {
      '/avis/moderation': [
        {
          id_avis: '4',
          commentaire: 'Bien',
          note_evaluation: 5,
          statut_avis: 'en_attente',
          evenement: 'Salon',
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(api.modifier).toHaveBeenCalledWith('POST', '/avis/4/moderation', {
      statut_avis: 'valide',
    });
  });
  it('protege l’admin dans la liste des comptes', async () => {
    const { fixture } = preparer(Comptes, 'admin', {
      '/comptes': [{ ...utilisateur, role: 'admin' }],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Suspendre');
    expect(fixture.nativeElement.textContent).not.toContain('Supprimer');
  });
  it('le tableau des prospects dirige vers la conversion', async () => {
    const { fixture } = preparer(Prospects, 'admin', {
      '/prospects': [
        {
          id_prospect: '7',
          entreprise: 'Test SAS',
          nom: 'Martin',
          prenom: 'Lea',
          email: 'lea@example.org',
          date_souhaitee: '2027-01-01',
          statut_prospect: 'a_contacter',
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('button[aria-label="Convertir en client : Test SAS"]')
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#prospect').value).toBe('7');
    expect(fixture.nativeElement.querySelector('.infos-demande').textContent).toContain(
      'lea@example.org',
    );
  });
  it('la vue des devis acceptes permet de passer l’evenement en cours', async () => {
    const { fixture, api } = preparer(Devis, 'admin', {
      '/devis': [
        {
          id_devis: '5',
          id_evenement: '3',
          intitule: 'Formule',
          statut_devis: 'accepte',
          evenement: 'Salon',
          entreprise: 'Test SAS',
        },
      ],
      '/evenements': [evenement],
      '/evenements/3': evenement,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Rechercher un prospect');
    [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)]
      .find(
        (b) =>
          b.textContent?.includes('Passer l’événement en cours') ||
          b.textContent?.includes("Passer l'événement en cours"),
      )!
      .click();
    await fixture.whenStable();
    expect(api.modifier).toHaveBeenCalledWith(
      'PATCH',
      '/evenements/3',
      expect.objectContaining({ statut_evenement: 'en_cours' }),
    );
  });
  it('affiche des journaux lisibles avec l’identifiant de l’utilisateur', async () => {
    const { fixture, api } = preparer(Journaux, 'admin', {
      '/comptes': [{ ...utilisateur, nom_utilisateur: 'ada' }],
      '/journaux?type_action=&page=1': [
        {
          horodatage: '2026-11-16T10:00:00+00:00',
          type_action: 'CHANGEMENT_STATUT_EVENEMENT',
          id_utilisateur: '1',
          details: { id_evenement: '3', ancien: 'brouillon', nouveau: 'accepte' },
        },
        {
          horodatage: '2026-11-16T09:00:00+00:00',
          type_action: 'SUPPRESSION_CLIENT',
          id_utilisateur: '9',
          details: { id_client: '2', nom_client: 'Léa Martin' },
        },
        {
          horodatage: '2026-11-16T08:00:00+00:00',
          type_action: 'CONNEXION_ECHOUEE',
          id_utilisateur: null,
          details: { email: 'inconnu@example.org', ip: '203.0.113.5' },
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const lignes = [...(fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<Element>)];
    const cellules = (i: number) =>
      [...lignes[i].querySelectorAll('td')].map((td) => td.textContent?.trim());
    expect(lignes).toHaveLength(3);
    expect(cellules(0)[1]).toBe('Changement de statut d’un événement');
    expect(cellules(0)[2]).toBe('ada (Ada Martin)');
    expect(cellules(0)[3]).toBe('Statut : Brouillon → Accepté · Événement n° 3');
    expect(cellules(1)[2]).toBe('Compte supprimé n° 9');
    expect(cellules(1)[3]).toBe('Client : Léa Martin · Fiche client n° 2');
    expect(cellules(2)[2]).toBe('—');
    expect(cellules(2)[3]).toBe('E-mail : inconnu@example.org · Adresse IP : 203.0.113.5');
    expect(fixture.nativeElement.querySelector('tbody').textContent).not.toContain('{');
    expect(api.get).toHaveBeenCalledWith('/comptes');
  });
  it('garde le numero du compte si la liste des comptes est indisponible', async () => {
    const indisponible = {
      then: (_: unknown, rejeter: (e: Error) => void) => rejeter(new Error('Indisponible')),
    };
    const { fixture } = preparer(Journaux, 'admin', {
      '/comptes': indisponible,
      '/journaux?type_action=&page=1': [
        {
          horodatage: '2026-11-16T10:00:00+00:00',
          type_action: 'GENERATION_PDF',
          id_utilisateur: '4',
          details: { id_devis: '8' },
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const cellules = [...fixture.nativeElement.querySelectorAll('tbody td')].map((td) =>
      (td as HTMLElement).textContent?.trim(),
    );
    expect(cellules[2]).toBe('Compte n° 4');
    expect(cellules[3]).toBe('Devis n° 8');
  });
  it('reformule les details sans perdre une cle inconnue', () => {
    expect(detailsLisibles({ id_devis: '5', statut_devis: 'modification' })).toBe(
      'Devis n° 5 · Réponse : Modification demandée',
    );
    expect(detailsLisibles({ origine: 'script' })).toBe('origine : script');
    expect(detailsLisibles({})).toBe('—');
  });
  it.each([Journaux, Comptes])('ne met plus de lien Tableau de bord en tete (%o)', async (page) => {
    const { fixture } = preparer(page as Type<unknown>, 'admin');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/administration"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Tableau de bord');
  });
  it('affiche le nom de l’evenement sur chaque carte de tache', async () => {
    const tache = {
      id_tache: '11',
      id_utilisateur: '1',
      id_evenement: '3',
      titre: 'Préparer la salle',
      description: null,
      statut_tache: 'en_cours',
      date_echeance: null,
      prenom: 'Ada',
      nom: 'Martin',
    };
    const { fixture } = preparer(Taches, 'employe', {
      '/evenements': [{ id_evenement: '3', nom: 'Salon de Lyon' }],
      '/evenements/3': { ...evenement, nom: 'Salon de Lyon', taches: [tache] },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const carte = fixture.nativeElement.querySelector('article') as HTMLElement;
    expect(carte.querySelector('.nom-evenement')?.textContent?.trim()).toBe('Salon de Lyon');
    expect(carte.querySelector('.statut-information')?.textContent?.trim()).toBe('En cours');
    expect(carte.querySelector('a')?.textContent).toContain('Salon de Lyon');
  });
  it('affiche les statuts en badges aux couleurs d’etat', async () => {
    const liste = preparer(EvenementsGestion, 'employe', {
      '/evenements': [evenement, { ...evenement, id_evenement: '4', statut_evenement: 'en_cours' }],
    });
    await liste.fixture.whenStable();
    liste.fixture.detectChanges();
    const badges = [...liste.fixture.nativeElement.querySelectorAll('.statut')].map(
      (b) => (b as HTMLElement).className,
    );
    expect(badges).toEqual(['statut statut-succes', 'statut statut-information']);
  });
  it('respecte la hierarchie des boutons : un primaire par zone, les autres a contour', async () => {
    const { fixture } = preparer(Clients, 'admin', {
      '/clients?recherche=': [client],
      '/clients/2': client,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)]
      .find((b) => b.textContent?.includes('Test SAS'))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    const boutons = [
      ...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>),
    ];
    for (const b of boutons)
      expect(
        ['bouton-primaire', 'bouton-secondaire', 'bouton-danger'].some((c) =>
          b.classList.contains(c),
        ),
        b.textContent ?? '',
      ).toBe(true);
    for (const zone of fixture.nativeElement.querySelectorAll('.actions') as NodeListOf<Element>)
      expect(zone.querySelectorAll('.bouton-primaire').length).toBeLessThanOrEqual(1);
    const rechercher = boutons.find((b) => b.textContent?.trim() === 'Rechercher')!;
    expect(rechercher.classList.contains('bouton-secondaire')).toBe(true);
    const supprimer = boutons.find((b) => b.textContent?.includes('Supprimer et anonymiser'))!;
    expect(supprimer.classList.contains('bouton-danger')).toBe(true);
  });
});
