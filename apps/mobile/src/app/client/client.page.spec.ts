import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Platform } from '@ionic/angular';

import { ApiService } from '../core/api.service';
import type { FicheClient } from '../core/gestion.types';

import { ClientPage } from './client.page';

describe('Fiche client mobile', () => {
  const fiche: FicheClient = {
    id_client: '9',
    entreprise: 'Société Aster',
    nom_contact: 'Martin',
    prenom_contact: 'Camille',
    email_contact: 'client@example.org',
    telephone: '06 12.34 56 78',
    adresse_postale: '12 rue de l’Exemple\n00000 Ville fictive',
    date_anonymisation: null,
  };
  async function ouvrir(
    options: { ios?: boolean; fiche?: Partial<FicheClient>; evenement?: string } = {},
  ) {
    const api = { get: vi.fn(async (): Promise<unknown> => ({ ...fiche, ...options.fiche })) };
    TestBed.configureTestingModule({
      imports: [ClientPage],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: Platform, useValue: { is: (p: string) => p === 'ios' && !!options.ios } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '9' }),
              queryParamMap: convertToParamMap(
                options.evenement ? { evenement: options.evenement } : {},
              ),
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ClientPage);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }
  const lien = (el: HTMLElement, texte: string) =>
    [...el.querySelectorAll('a')].find((a) => a.textContent?.includes(texte));

  it('genere les liens d appel, d e-mail et d itineraire Google Maps hors iPhone', async () => {
    const { el, api } = await ouvrir();
    expect(api.get).toHaveBeenCalledWith('/clients/9');
    expect(el.querySelector('h1')?.textContent).toContain('Société Aster');
    expect(el.textContent).toContain('Contact : Camille Martin');
    expect(lien(el, 'Appeler Camille Martin')?.getAttribute('href')).toBe('tel:0612345678');
    expect(lien(el, 'Envoyer un e-mail')?.getAttribute('href')).toBe('mailto:client@example.org');
    const itineraire = lien(el, 'Ouvrir l’itinéraire');
    expect(itineraire?.getAttribute('href')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=12%20rue%20de%20l%E2%80%99Exemple%0A00000%20Ville%20fictive',
    );
    expect(itineraire?.getAttribute('rel')).toBe('noopener');
  });
  it('ouvre Plans sur iPhone', async () => {
    const { el } = await ouvrir({ ios: true });
    expect(lien(el, 'Ouvrir l’itinéraire')?.getAttribute('href')).toBe(
      'https://maps.apple.com/?daddr=12%20rue%20de%20l%E2%80%99Exemple%0A00000%20Ville%20fictive',
    );
  });
  it('masque une action dont la coordonnee manque et l annonce', async () => {
    const { el } = await ouvrir({ fiche: { telephone: '', adresse_postale: null } });
    expect(lien(el, 'Appeler')).toBeUndefined();
    expect(lien(el, 'itinéraire')).toBeUndefined();
    expect(el.textContent).toContain('Aucun numéro de téléphone renseigné.');
    expect(el.textContent).toContain('Aucune adresse postale renseignée.');
    expect(lien(el, 'Envoyer un e-mail')).toBeTruthy();
  });
  it('masque toutes les actions d une fiche anonymisee', async () => {
    const { el } = await ouvrir({
      fiche: {
        entreprise: null,
        nom_contact: null,
        prenom_contact: null,
        email_contact: null,
        telephone: null,
        adresse_postale: null,
        date_anonymisation: '2026-11-10T10:00:00.000Z',
      },
    });
    expect(el.textContent).toContain('ses coordonnées ne sont plus disponibles');
    expect(
      el.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href^="https:"]'),
    ).toHaveLength(0);
  });
  it('revient a l evenement d origine, sinon a la liste', async () => {
    const avec = await ouvrir({ evenement: '4' });
    expect(lien(avec.el, 'Retour à l’événement')?.getAttribute('href')).toBe('/evenements/4');
    TestBed.resetTestingModule();
    const sans = await ouvrir({ evenement: 'javascript:alert(1)' });
    expect(lien(sans.el, 'Retour aux événements')?.getAttribute('href')).toBe('/home');
  });
  it('affiche l erreur du serveur', async () => {
    const api = {
      get: vi.fn(async () => {
        throw new HttpErrorResponse({ status: 404, error: { erreur: 'Client introuvable.' } });
      }),
    };
    TestBed.configureTestingModule({
      imports: [ClientPage],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: Platform, useValue: { is: () => false } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '9' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ClientPage);
    await fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Client introuvable.',
    );
  });
});
