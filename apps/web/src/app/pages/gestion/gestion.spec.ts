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
});
