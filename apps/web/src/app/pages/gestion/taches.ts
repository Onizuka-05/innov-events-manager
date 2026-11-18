import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';
import { type Evenement, type Tache } from '../../core/gestion.models';
import { BadgeStatut } from '../../core/badge-statut';

/** Tache affichee avec le nom de son evenement. */
type TacheAffichee = Tache & { evenement: string };

/** Consultation des taches par projet avec les routes deja disponibles. */
@Component({
  selector: 'app-taches',
  imports: [RouterLink, DatePipe, BadgeStatut],
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
          <header class="carte-en-tete">
            <h2>{{ t.titre }}</h2>
            <p class="texte-secondaire">
              Événement : <strong class="nom-evenement">{{ t.evenement }}</strong>
            </p>
          </header>
          @if (t.description) {
            <p>{{ t.description }}</p>
          }
          <p class="meta">
            <span>{{ t.prenom }} {{ t.nom }}</span>
            <app-badge-statut [statut]="t.statut_tache" />
            @if (t.date_echeance) {
              <span>Échéance : {{ t.date_echeance | date: 'short' }}</span>
            }
          </p>
          <a routerLink="/administration/evenements" [queryParams]="{ id: t.id_evenement }"
            >Ouvrir la fiche de l’événement {{ t.evenement }}</a
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
  protected readonly taches = signal<TacheAffichee[]>([]);
  protected readonly erreur = signal('');
  protected readonly chargement = signal(false);
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
      // Nom repris de la liste, puis de la fiche ; numero en dernier recours.
      const taches = fiches.flatMap((fiche, i) =>
        fiche.taches.map((tache) => ({
          ...tache,
          evenement: evenements[i].nom || fiche.nom || 'Événement n° ' + evenements[i].id_evenement,
        })),
      );
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
