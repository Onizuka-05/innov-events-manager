import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Devis } from './devis';
import { ApiService } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';

const prospect = {
  id_prospect: '7',
  entreprise: 'Test Devis',
  nom: 'Durand',
  prenom: 'Léa',
  email: 'client-j8@example.org',
  telephone: '0600000002',
  statut_prospect: 'a_contacter',
  id_client: null,
  id_type_evenement: 1,
  lieu_souhaite: 'Lyon',
  date_souhaitee: '2027-01-20',
};

function preparer(role: 'admin' | 'client', listeDevis: object[] = []) {
  const api = {
    get: vi.fn(async (chemin: string): Promise<unknown> =>
      chemin === '/devis' ? listeDevis : chemin === '/prospects' ? [prospect] : [],
    ),
    modifier: vi.fn(async () => ({})),
  };
  TestBed.configureTestingModule({
    imports: [Devis],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      {
        provide: AuthentificationService,
        useValue: { utilisateur: () => ({ role, prenom: 'Test' }) },
      },
    ],
  });
  return { api, fixture: TestBed.createComponent(Devis) };
}
describe('parcours devis', () => {
  it('affiche la rubrique devis au client', async () => {
    const { fixture } = preparer('client');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mes devis');
  });
  it('ne montre pas de formulaire de conversion au client', async () => {
    const { fixture } = preparer('client');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Convertir un prospect');
  });
  it('affiche les outils de gestion à l’administrateur', async () => {
    const { fixture } = preparer('admin');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Créer un devis');
  });
  it('ne conserve pas la conversion dans la rubrique Devis', async () => {
    const { fixture } = preparer('admin');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#prospect')).toBeNull();
    expect(fixture.nativeElement.querySelector('#nom')).not.toBeNull();
  });
});

describe('Recherche des propositions du client', () => {
  it('cumule recherche sans accents et filtre par statut sans appel supplementaire', async () => {
    const { fixture, api } = preparer('client', [
      {
        id_devis: '1',
        id_evenement: '3',
        intitule: 'Formule Équipe',
        evenement: 'Salon Aster',
        statut_devis: 'etude_client',
      },
      {
        id_devis: '2',
        id_evenement: '3',
        intitule: 'Formule Premium',
        evenement: 'Salon Aster',
        statut_devis: 'accepte',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const recherche = el.querySelector('#recherche-devis') as HTMLInputElement;
    recherche.value = 'equipe aster';
    recherche.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('1 devis affiché sur 2');
    const filtre = el.querySelector('#filtre-devis') as HTMLSelectElement;
    filtre.value = 'accepte';
    filtre.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(0);
    (el.querySelector('.champ-filtre button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(api.get.mock.calls.filter(([p]) => p === '/devis')).toHaveLength(1);
  });
});
