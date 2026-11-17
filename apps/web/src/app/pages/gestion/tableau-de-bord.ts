import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import { type Note, type Client, type Evenement } from '../../core/gestion.models';
import { BadgeStatut } from '../../core/badge-statut';
import { NotesTaches } from './notes-taches';
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
/** Tableau de bord administrateur et gestion des notes globales. */
@Component({
  selector: 'app-tableau-de-bord',
  imports: [RouterLink, DatePipe, NotesTaches, BadgeStatut],
  styleUrl: './gestion.css',
  template: `<section class="conteneur page gestion">
    <h1>Tableau de bord</h1>
    @if (chargement()) {
      <p role="status">Chargement du tableau de bord…</p>
    }
    @if (erreur()) {
      <p role="alert" class="erreur">{{ erreur() }}</p>
      <button class="bouton-secondaire" type="button" [disabled]="chargement()" (click)="charger()">
        Réessayer
      </button>
    }
    @if (tableau(); as t) {
      <section class="carte bloc" aria-labelledby="indicateurs">
        <h2 id="indicateurs">Indicateurs clés</h2>
        <dl class="indicateurs">
          <div>
            <dt>Clients actifs</dt>
            <dd>{{ t.clients_actifs.length }}</dd>
          </div>
          <div>
            <dt>Événements en brouillon</dt>
            <dd>{{ t.brouillons.length }}</dd>
          </div>
        </dl>
      </section>
      <div class="grille">
        <section class="carte bloc">
          <h2>3 prochains événements</h2>
          <ul class="liste liste-bord">
            @for (e of t.prochains_evenements; track e.id_evenement) {
              <li>
                <h3>
                  <a
                    routerLink="/administration/evenements"
                    [queryParams]="{ id: e.id_evenement }"
                    >{{ e.nom }}</a
                  >
                </h3>
                <p>
                  {{ e.entreprise || 'Client anonymisé' }}
                  @if (e.prenom_contact || e.nom_contact) {
                    · {{ e.prenom_contact }} {{ e.nom_contact }}
                  }
                </p>
                <p>
                  <time [attr.datetime]="e.date_debut">{{
                    e.date_debut | date: 'dd/MM/yyyy · HH:mm'
                  }}</time>
                </p>
                @if (details(e.id_evenement); as d) {
                  <app-badge-statut [statut]="d.statut_evenement" />
                }
              </li>
            } @empty {
              <li>Aucun événement à venir.</li>
            }
          </ul>
        </section>
        <section class="carte bloc">
          <h2>5 notes récentes</h2>
          <ul class="liste liste-bord">
            @for (n of t.notes_recentes; track n.id_note) {
              <li>
                <p class="texte-note">{{ n.contenu }}</p>
                <p class="aide">
                  {{ n.prenom }} {{ n.nom }} ·
                  <time [attr.datetime]="n.date_creation">{{
                    n.date_creation | date: 'dd/MM/yyyy · HH:mm'
                  }}</time>
                </p>
                @if (n.id_evenement) {
                  @if (details(n.id_evenement); as d) {
                    <p>
                      <a
                        routerLink="/administration/evenements"
                        [queryParams]="{ id: d.id_evenement }"
                        >{{ d.nom }}</a
                      >
                      · {{ d.entreprise || 'Client anonymisé' }}
                    </p>
                    <app-badge-statut [statut]="d.statut_evenement" />
                  }
                } @else {
                  <p class="aide">Note globale</p>
                }
              </li>
            } @empty {
              <li>Aucune note.</li>
            }
          </ul>
        </section>
        <section class="carte bloc">
          <h2>Clients actifs</h2>
          <p>Au moins un événement en cours.</p>
          <ul class="liste liste-bord">
            @for (c of t.clients_actifs; track c.id_client) {
              <li>
                <h3>
                  <a routerLink="/administration/clients" [queryParams]="{ id: c.id_client }">{{
                    c.entreprise
                  }}</a>
                </h3>
                <p>{{ c.prenom_contact }} {{ c.nom_contact }}</p>
                <app-badge-statut statut="en_cours" />
              </li>
            } @empty {
              <li>Aucun client actif.</li>
            }
          </ul>
        </section>
        <section class="carte bloc">
          <h2>Événements en brouillon</h2>
          <ul class="liste liste-bord">
            @for (e of t.brouillons; track e.id_evenement) {
              <li>
                <h3>
                  <a
                    routerLink="/administration/evenements"
                    [queryParams]="{ id: e.id_evenement }"
                    >{{ e.nom }}</a
                  >
                </h3>
                <p>{{ e.entreprise || 'Client anonymisé' }}</p>
                @if (details(e.id_evenement); as d) {
                  <p>
                    <time [attr.datetime]="d.date_debut">{{
                      d.date_debut | date: 'dd/MM/yyyy · HH:mm'
                    }}</time>
                  </p>
                }
                <app-badge-statut statut="brouillon" />
              </li>
            } @empty {
              <li>Aucun brouillon.</li>
            }
          </ul>
        </section>
      </div>
    }
    <app-notes-taches [notes]="notes()" (changement)="charger()" />
  </section>`,
})
export class TableauDeBord {
  private readonly api = inject(ApiService);
  protected readonly tableau = signal<Tableau | null>(null);
  protected readonly notes = signal<Note[]>([]);
  protected readonly evenements = signal<Evenement[]>([]);
  protected readonly chargement = signal(false);
  protected details(id: string) {
    return this.evenements().find((e) => e.id_evenement === id);
  }
  protected readonly erreur = signal('');
  constructor() {
    void this.charger();
  }
  protected async charger(): Promise<void> {
    if (this.chargement()) return;
    this.chargement.set(true);
    this.erreur.set('');
    try {
      const [tableau, notes, evenements] = await Promise.all([
        this.api.get<Tableau>('/administration/tableau-de-bord'),
        this.api.get<Note[]>('/notes-globales'),
        this.api.get<Evenement[]>('/evenements'),
      ]);
      this.tableau.set(tableau);
      this.notes.set(notes);
      this.evenements.set(evenements);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
}
