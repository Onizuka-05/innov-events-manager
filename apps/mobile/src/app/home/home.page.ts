import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular';

import { ApiService, messageErreur } from '../core/api.service';
import { AuthentificationService } from '../core/authentification.service';
import type { Evenement } from '../core/gestion.types';
import { familleStatut, libelleStatut } from '../core/statuts';

/** Statuts possibles dans la liste des evenements a venir. */
const STATUTS_A_VENIR = ['brouillon', 'accepte', 'en_cours'] as const;

/** Texte compare sans casse ni accents (« equipe » trouve « Équipe »). */
function normaliser(valeur: string | null): string {
  return (valeur ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Liste chronologique rechargee a chaque ouverture de l'espace mobile. */
@Component({
  selector: 'app-home',
  imports: [DatePipe, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent],
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
  /** Recherche sur le nom, le client et le lieu ; filtre par statut. Les deux se cumulent. */
  protected readonly recherche = signal('');
  protected readonly statut = signal('');
  protected readonly statuts = STATUTS_A_VENIR;
  protected readonly affiches = computed(() => {
    const termes = normaliser(this.recherche().trim()).split(/\s+/u).filter(Boolean);
    return this.evenements().filter((e) => {
      if (this.statut() && e.statut_evenement !== this.statut()) return false;
      const texte = normaliser(`${e.nom} ${e.entreprise ?? ''} ${e.lieu}`);
      return termes.every((terme) => texte.includes(terme));
    });
  });
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
  protected rechercher(evenement: Event): void {
    this.recherche.set((evenement.target as HTMLInputElement).value);
  }
  protected filtrer(evenement: Event): void {
    this.statut.set((evenement.target as HTMLSelectElement).value);
  }
  protected reinitialiser(): void {
    this.recherche.set('');
    this.statut.set('');
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
