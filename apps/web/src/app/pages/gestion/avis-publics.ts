import { Component, inject, signal } from '@angular/core';
import { ApiService, messageErreur } from '../../core/api.service';
interface Avis {
  id_avis: string;
  commentaire: string;
  note_evaluation: number;
  evenement: string;
}
/** Affichage public des seuls avis valides, sans nom de client. */
@Component({
  selector: 'app-avis-publics',
  template: `<section class="conteneur page">
    <h1>Avis</h1>
    @if (erreur()) {
      <p role="alert">{{ erreur() }}</p>
    }
    @for (a of avis(); track a.id_avis) {
      <article class="carte">
        <h2>{{ a.evenement }}</h2>
        <p>{{ a.note_evaluation }} / 5</p>
        <p>{{ a.commentaire }}</p>
      </article>
    } @empty {
      <p>Aucun avis publié pour le moment.</p>
    }
  </section>`,
})
export class AvisPublics {
  private readonly api = inject(ApiService);
  protected readonly avis = signal<Avis[]>([]);
  protected readonly erreur = signal('');
  constructor() {
    void this.charger();
  }
  private async charger() {
    try {
      this.avis.set(await this.api.get('/avis'));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
}
