import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';
import { LIBELLES, type Evenement, type Tache } from '../../core/gestion.models';

/** Consultation des taches par projet avec les routes deja disponibles. */
@Component({
  selector: 'app-taches',
  imports: [RouterLink, DatePipe],
  styleUrl: './gestion.css',
  template: `<section class="conteneur page gestion">
    <h1>{{ admin() ? 'Tâches' : 'Mes tâches' }}</h1>
    @if (erreur()) {
      <p class="erreur" role="alert">{{ erreur() }}</p>
    }
    @if (chargement()) {
      <p role="status">Chargement des tâches…</p>
    } @else if (!erreur()) {
      @for (t of taches(); track t.id_tache) {
        <article class="carte bloc">
          <h2>{{ t.titre }}</h2>
          <p>{{ t.description }}</p>
          <p>
            {{ t.prenom }} {{ t.nom }} · {{ libelles[t.statut_tache] }} ·
            {{ t.date_echeance | date: 'short' }}
          </p>
          <a routerLink="/administration/evenements" [queryParams]="{ id: t.id_evenement }"
            >Ouvrir la fiche de l’événement</a
          >
        </article>
      } @empty {
        <p>Aucune tâche.</p>
      }
    }
  </section>`,
})
export class Taches {
  private readonly auth = inject(AuthentificationService);
  private readonly api = inject(ApiService);
  protected readonly taches = signal<Tache[]>([]);
  protected readonly erreur = signal('');
  protected readonly chargement = signal(false);
  protected readonly libelles = LIBELLES;
  constructor() {
    void this.charger();
  }
  protected admin() {
    return this.auth.utilisateur()?.role === 'admin';
  }
  /** Charge les fiches sans inventer de route de liste ou de filtre serveur. */
  private async charger() {
    this.chargement.set(true);
    try {
      const evenements = await this.api.get<Evenement[]>('/evenements');
      const fiches = await Promise.all(
        evenements.map((e) =>
          this.api.get<Evenement>('/evenements/' + encodeURIComponent(e.id_evenement)),
        ),
      );
      const taches = fiches.flatMap((fiche) => fiche.taches);
      const id = this.auth.utilisateur()?.id_utilisateur;
      this.taches.set(
        this.admin() ? taches : taches.filter((tache) => tache.id_utilisateur === id),
      );
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
}
