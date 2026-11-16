import { Component, inject, signal } from '@angular/core';
import { ApiService, messageErreur } from '../../core/api.service';
import { LIBELLES } from '../../core/gestion.models';
interface Avis {
  id_avis: string;
  commentaire: string;
  note_evaluation: number;
  statut_avis: string;
  evenement: string;
}
/** Les avis ne deviennent publics qu'apres validation explicite. */
@Component({
  selector: 'app-moderation',
  styleUrl: './gestion.css',
  template: `<section class="conteneur page gestion">
    <h1>Avis</h1>
    @if (erreur()) {
      <p role="alert" class="erreur">{{ erreur() }}</p>
    }
    @if (message()) {
      <p role="status">{{ message() }}</p>
    }
    @for (a of avis(); track a.id_avis) {
      <article class="carte bloc">
        <h2>{{ a.evenement }}</h2>
        <p>{{ a.note_evaluation }} / 5 · {{ libelles[a.statut_avis] }}</p>
        <p>{{ a.commentaire }}</p>
        @if (a.statut_avis === 'en_attente') {
          <button type="button" [disabled]="envoi()" (click)="moderer(a, 'valide')">Valider</button>
          <button type="button" [disabled]="envoi()" (click)="moderer(a, 'refuse')">Refuser</button>
        }
      </article>
    } @empty {
      <p>Aucun avis.</p>
    }
  </section>`,
})
export class Moderation {
  private readonly api = inject(ApiService);
  protected readonly avis = signal<Avis[]>([]);
  protected readonly erreur = signal('');
  protected readonly message = signal('');
  protected readonly envoi = signal(false);
  protected readonly libelles = LIBELLES;
  constructor() {
    void this.charger();
  }
  private async charger() {
    try {
      this.avis.set(await this.api.get('/avis/moderation'));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected async moderer(a: Avis, statut_avis: string) {
    if (this.envoi()) return;
    this.envoi.set(true);
    try {
      await this.api.modifier('POST', '/avis/' + a.id_avis + '/moderation', { statut_avis });
      await this.charger();
      this.message.set('Avis modéré.');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
