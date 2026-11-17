import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService, messageErreur } from '../../core/api.service';
interface Avis {
  id_avis: string;
  commentaire: string;
  note_evaluation: number;
  evenement: string;
  date_creation?: string;
}
/** Avis publics valides, sans identite du client et avec une note lisible a voix haute. */
@Component({
  selector: 'app-avis-publics',
  imports: [DatePipe],
  styleUrl: '../catalogue/catalogue.css',
  template: `<section class="conteneur page catalogue">
    <h1>Avis</h1>
    <p class="introduction">
      Les retours de nos clients sur leurs événements, après modération par notre équipe.
    </p>
    @if (chargement()) {
      <p role="status">Chargement des avis…</p>
    }
    @if (erreur()) {
      <p class="erreur" role="alert">{{ erreur() }}</p>
      <button class="bouton-secondaire" type="button" (click)="charger()">Réessayer</button>
    }
    @if (!chargement() && !erreur()) {
      <div class="avis-liste">
        @for (a of avis(); track a.id_avis) {
          <article class="carte">
            <h2>{{ a.evenement }}</h2>
            <p class="note-avis">{{ a.note_evaluation }} sur 5</p>
            @if (a.date_creation) {
              <p class="aide">
                <time [attr.datetime]="a.date_creation">{{
                  a.date_creation | date: 'dd/MM/yyyy'
                }}</time>
              </p>
            }
            <p class="commentaire">{{ a.commentaire }}</p>
          </article>
        } @empty {
          <p>Aucun avis publié pour le moment.</p>
        }
      </div>
    }
  </section>`,
})
export class AvisPublics {
  private readonly api = inject(ApiService);
  protected readonly avis = signal<Avis[]>([]);
  protected readonly erreur = signal('');
  protected readonly chargement = signal(false);
  constructor() {
    void this.charger();
  }
  protected async charger(): Promise<void> {
    if (this.chargement()) return;
    this.chargement.set(true);
    this.erreur.set('');
    try {
      this.avis.set(await this.api.get<Avis[]>('/avis'));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
}
