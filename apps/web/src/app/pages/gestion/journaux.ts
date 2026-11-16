import { Component, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
interface Journal {
  horodatage: string;
  type_action: string;
  id_utilisateur: string | null;
  details: Record<string, string | number | null>;
}
/** Consultation admin paginee et filtre exact du type d'action. */
@Component({
  selector: 'app-journaux',
  imports: [DatePipe, JsonPipe, FormsModule, RouterLink],
  styleUrl: './gestion.css',
  template: `<section class="conteneur page gestion">
    <a routerLink="/administration">Tableau de bord</a>
    <h1>Journaux</h1>
    @if (erreur()) {
      <p role="alert" class="erreur">{{ erreur() }}</p>
    }
    <form class="formulaire" (ngSubmit)="page = 1; charger()">
      <label for="type-action">Type d'action</label
      ><select id="type-action" name="type_action" [(ngModel)]="type_action">
        <option value="">Tous</option>
        @for (t of types; track t) {
          <option [value]="t">{{ t }}</option>
        }</select
      ><button type="submit">Filtrer</button>
    </form>
    <div class="tableau" tabindex="0" role="region" aria-label="Journaux de gestion">
      <table>
        <caption>
          Journaux — page
          {{
            page
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Action</th>
            <th scope="col">Utilisateur</th>
            <th scope="col">Détails</th>
          </tr>
        </thead>
        <tbody>
          @for (j of journaux(); track $index) {
            <tr>
              <td>{{ j.horodatage | date: 'short' }}</td>
              <td>{{ j.type_action }}</td>
              <td>{{ j.id_utilisateur || '—' }}</td>
              <td>{{ j.details | json }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4">Aucun journal.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <div class="actions">
      <button type="button" [disabled]="page === 1" (click)="page = page - 1; charger()">
        Précédent</button
      ><button
        type="button"
        [disabled]="journaux().length < 50"
        (click)="page = page + 1; charger()"
      >
        Suivant
      </button>
    </div>
  </section>`,
})
export class Journaux {
  private readonly api = inject(ApiService);
  protected readonly erreur = signal('');
  protected readonly journaux = signal<Journal[]>([]);
  protected type_action = '';
  protected page = 1;
  protected readonly types = [
    'CONNEXION_REUSSIE',
    'CONNEXION_ECHOUEE',
    'CREATION_CLIENT',
    'MODIFICATION_CLIENT',
    'SUPPRESSION_CLIENT',
    'CREATION_EVENEMENT',
    'CHANGEMENT_STATUT_EVENEMENT',
    'GENERATION_PDF',
    'ENVOI_DEVIS',
    'REPONSE_DEVIS',
  ];
  constructor() {
    void this.charger();
  }
  protected async charger() {
    this.erreur.set('');
    try {
      this.journaux.set(
        await this.api.get(
          '/journaux?type_action=' + encodeURIComponent(this.type_action) + '&page=' + this.page,
        ),
      );
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
}
