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

function preparer(role: 'admin' | 'client') {
  const api = {
    get: vi.fn(async (chemin: string) => (chemin === '/prospects' ? [prospect] : [])),
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
