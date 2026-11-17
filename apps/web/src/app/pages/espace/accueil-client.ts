import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';
import { BadgeStatut } from '../../core/badge-statut';
import type { AccueilClientDonnees } from '../../core/espace-client.models';
/** Les trois prochains evenements et le suivi des demandes rattachees au compte. */
@Component({
  selector: 'app-accueil-client',
  imports: [DatePipe, RouterLink, BadgeStatut],
  styleUrl: './espace-client.css',
  templateUrl: './accueil-client.html',
})
export class AccueilClient {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthentificationService);
  protected readonly donnees = signal<AccueilClientDonnees | null>(null);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  constructor() {
    void this.charger();
  }
  /** Recharge les donnees du seul compte connecte. */
  protected async charger(): Promise<void> {
    if (this.chargement()) return;
    this.chargement.set(true);
    this.erreur.set('');
    try {
      this.donnees.set(await this.api.get<AccueilClientDonnees>('/espace-client'));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
}
