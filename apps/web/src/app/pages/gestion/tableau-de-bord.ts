import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import { type Note, type Client } from '../../core/gestion.models';
import { NotesTaches } from './notes-taches';
import { Prospects } from './prospects';
interface Tableau {
  prochains_evenements: {
    id_evenement: string;
    nom: string;
    date_debut: string;
    entreprise: string | null;
    prenom_contact: string | null;
    nom_contact: string | null;
  }[];
  notes_recentes: Note[];
  clients_actifs: Client[];
  brouillons: { id_evenement: string; nom: string; entreprise: string | null }[];
}
/** Tableau de bord d'entree administrateur et demandes de prospects. */
@Component({
  selector: 'app-tableau-de-bord',
  imports: [RouterLink, DatePipe, NotesTaches, Prospects],
  styleUrl: './gestion.css',
  template: `<section class="conteneur page gestion">
    <h1>Tableau de bord</h1>
    <nav aria-label="Administration" class="navigation">
      <a routerLink="/equipe/clients">Clients</a><a routerLink="/equipe/evenements">Événements</a
      ><a routerLink="/devis">Devis</a><a routerLink="/administration/comptes">Comptes</a
      ><a routerLink="/equipe/avis">Modérer les avis</a
      ><a routerLink="/administration/journaux">Journaux</a
      ><a routerLink="/administration/remerciement">Message de remerciement</a>
    </nav>
    @if (erreur()) {
      <p role="alert" class="erreur">{{ erreur() }}</p>
    }
    @if (tableau(); as t) {
      <div class="grille">
        <section class="carte bloc">
          <h2>3 prochains événements</h2>
          <ul>
            @for (e of t.prochains_evenements; track e.id_evenement) {
              <li>
                <a routerLink="/equipe/evenements" [queryParams]="{ id: e.id_evenement }">{{
                  e.nom
                }}</a>
                — {{ e.entreprise || 'Client anonymisé' }} {{ e.prenom_contact }}
                {{ e.nom_contact }} · {{ e.date_debut | date: 'short' }}
              </li>
            } @empty {
              <li>Aucun événement à venir.</li>
            }
          </ul>
        </section>
        <section class="carte bloc">
          <h2>5 notes récentes</h2>
          <ul>
            @for (n of t.notes_recentes; track n.id_note) {
              <li>{{ n.contenu }} — {{ n.prenom }} {{ n.nom }}</li>
            } @empty {
              <li>Aucune note.</li>
            }
          </ul>
        </section>
        <section class="carte bloc">
          <h2>Clients actifs ({{ t.clients_actifs.length }})</h2>
          <p>Au moins un événement en cours.</p>
          <ul>
            @for (c of t.clients_actifs; track c.id_client) {
              <li>{{ c.entreprise }}</li>
            } @empty {
              <li>Aucun client actif.</li>
            }
          </ul>
        </section>
        <section class="carte bloc">
          <h2>Événements en brouillon</h2>
          <ul>
            @for (e of t.brouillons; track e.id_evenement) {
              <li>
                <a routerLink="/equipe/evenements" [queryParams]="{ id: e.id_evenement }">{{
                  e.nom
                }}</a>
                — {{ e.entreprise || 'Client anonymisé' }}
              </li>
            } @empty {
              <li>Aucun brouillon.</li>
            }
          </ul>
        </section>
      </div>
    }
    <app-prospects /><app-notes-taches [notes]="notes()" (changement)="charger()" />
  </section>`,
})
export class TableauDeBord {
  private readonly api = inject(ApiService);
  protected readonly tableau = signal<Tableau | null>(null);
  protected readonly notes = signal<Note[]>([]);
  protected readonly erreur = signal('');
  constructor() {
    void this.charger();
  }
  protected async charger() {
    try {
      this.tableau.set(await this.api.get('/administration/tableau-de-bord'));
      this.notes.set(await this.api.get('/notes-globales'));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
}
