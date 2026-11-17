import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular';

import { ApiService, messageErreur } from '../core/api.service';
import { AuthentificationService } from '../core/authentification.service';
import { familleStatut, libelleStatut } from '../core/statuts';

interface Evenement {
  id_evenement: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  lieu: string;
  statut_evenement: string;
  entreprise: string | null;
}
/** Liste chronologique rechargee a chaque ouverture de l'espace mobile. */
@Component({
  selector: 'app-home',
  imports: [DatePipe, IonHeader, IonToolbar, IonTitle, IonContent],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthentificationService);
  protected readonly evenements = signal<Evenement[]>([]);
  protected readonly erreur = signal('');
  protected readonly chargement = signal(false);
  /** Badge d'etat aux couleurs de la charte, libelle toujours ecrit en clair. */
  protected readonly famille = familleStatut;
  protected readonly libelle = libelleStatut;
  /** Ionic conserve les pages : cette methode recharge aussi apres une navigation de retour. */
  async ionViewWillEnter(): Promise<void> {
    await this.charger();
  }
  protected async charger(): Promise<void> {
    if (this.chargement()) return;
    this.chargement.set(true);
    this.erreur.set('');
    try {
      this.evenements.set(await this.api.get<Evenement[]>('/evenements?avenir=true'));
    } catch (e) {
      this.evenements.set([]);
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
  protected async deconnecter(): Promise<void> {
    try {
      await this.auth.deconnecter();
      this.evenements.set([]);
      await this.router.navigateByUrl('/connexion');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
}
