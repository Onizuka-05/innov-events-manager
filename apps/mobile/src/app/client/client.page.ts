import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, Platform } from '@ionic/angular';

import { ApiService, messageErreur } from '../core/api.service';
import { lienCourriel, lienItineraire, lienTelephone } from '../core/contact';
import type { FicheClient } from '../core/gestion.types';

const IDENTIFIANT = /^[1-9][0-9]{0,17}$/u;

/** Fiche contact simplifiee (MOB-03) : appeler, envoyer un e-mail, ouvrir l'itineraire. */
@Component({
  selector: 'app-client',
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonContent],
  templateUrl: './client.page.html',
})
export class ClientPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly plateforme = inject(Platform);
  protected readonly fiche = signal<FicheClient | null>(null);
  protected readonly erreur = signal('');
  protected readonly chargement = signal(false);
  protected readonly anonymisee = computed(() => !!this.fiche()?.date_anonymisation);
  protected readonly telephone = computed(() => lienTelephone(this.fiche()?.telephone ?? null));
  protected readonly courriel = computed(() => lienCourriel(this.fiche()?.email_contact ?? null));
  /** Plans sur iPhone et iPad (detection de plateforme par Ionic), Google Maps ailleurs. */
  protected readonly itineraire = computed(() =>
    lienItineraire(this.fiche()?.adresse_postale ?? null, this.plateforme.is('ios')),
  );
  /** Retour vers l'evenement d'origine si l'adresse l'indique, sinon vers la liste. */
  protected readonly evenement = computed(() => {
    const id = this.route.snapshot.queryParamMap.get('evenement') ?? '';
    return IDENTIFIANT.test(id) ? id : null;
  });

  async ionViewWillEnter(): Promise<void> {
    await this.charger();
  }

  protected async charger(): Promise<void> {
    if (this.chargement()) return;
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!IDENTIFIANT.test(id)) {
      this.erreur.set('Client introuvable.');
      return;
    }
    this.chargement.set(true);
    this.erreur.set('');
    try {
      this.fiche.set(await this.api.get<FicheClient>(`/clients/${id}`));
    } catch (e) {
      this.fiche.set(null);
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
}
