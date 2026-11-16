import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';
import { LIBELLES, type Evenement, type Compte, type Client } from '../../core/gestion.models';
import { NotesTaches } from './notes-taches';

/** Fiches evenement : lecture en equipe, structure et cycle pilotes par l'administrateur. */
@Component({
  selector: 'app-evenements-gestion',
  imports: [FormsModule, DatePipe, NotesTaches],
  styleUrl: './gestion.css',
  template: ` <section class="conteneur page gestion">
    <h1>Événements</h1>
    @if (erreur()) {
      <p role="alert" class="erreur">{{ erreur() }}</p>
    }
    @if (message()) {
      <p role="status">{{ message() }}</p>
    }
    @if (admin()) {
      <button type="button" (click)="nouveau()">Créer un événement</button>
    }
    <ul class="liste">
      @for (e of evenements(); track e.id_evenement) {
        <li>
          <button type="button" (click)="ouvrir(e.id_evenement)">
            {{ e.nom }} — {{ e.entreprise || 'Client anonymisé' }}
          </button>
          · {{ e.date_debut | date: 'short' }} · {{ libelles[e.statut_evenement] }}
        </li>
      } @empty {
        <li>Aucun événement.</li>
      }
    </ul>
    @if (selection(); as e) {
      <section class="carte bloc">
        <h2>{{ e.nom }}</h2>
        <dl>
          <dt>Client</dt>
          <dd>{{ e.entreprise || 'Client anonymisé' }}</dd>
          <dt>Début</dt>
          <dd>{{ e.date_debut | date: 'short' }}</dd>
          <dt>Fin</dt>
          <dd>{{ e.date_fin | date: 'short' }}</dd>
          <dt>Lieu</dt>
          <dd>{{ e.lieu }}</dd>
          <dt>Statut</dt>
          <dd>{{ libelles[e.statut_evenement] }}</dd>
          <dt>Type / thème</dt>
          <dd>{{ typeLibelle(e.id_type_evenement) }} / {{ themeLibelle(e.id_theme) }}</dd>
        </dl>
        @if (e.image_url) {
          <img [src]="e.image_url" [alt]="'Illustration de ' + e.nom" width="480" />
        }
        @if (admin()) {
          <button type="button" (click)="modifier(e)">Modifier l'événement</button>
          <button type="button" [disabled]="envoi()" (click)="supprimer(e)">
            Supprimer l'événement
          </button>
        }
      </section>
      <app-notes-taches
        [id_evenement]="e.id_evenement"
        [notes]="e.notes"
        [taches]="e.taches"
        [comptes]="comptes()"
        (changement)="ouvrir(e.id_evenement)"
      />
    }
    @if (edition()) {
      <form class="formulaire carte bloc" (ngSubmit)="enregistrer()">
        <h2>{{ id_evenement ? 'Modifier' : 'Créer' }} un événement</h2>
        @if (!id_evenement) {
          <label for="client-evenement">Client</label
          ><select id="client-evenement" name="id_client" required [(ngModel)]="id_client">
            <option value="">Choisir</option>
            @for (c of clients(); track c.id_client) {
              @if (!c.date_anonymisation) {
                <option [value]="c.id_client">{{ c.entreprise }}</option>
              }
            }
          </select>
        }
        <label for="nom-evenement">Nom</label
        ><input
          id="nom-evenement"
          name="nom"
          required
          maxlength="255"
          [(ngModel)]="formulaire.nom"
        />
        <label for="type-evenement">Type</label
        ><select
          id="type-evenement"
          name="id_type_evenement"
          required
          [(ngModel)]="formulaire.id_type_evenement"
        >
          @for (t of types(); track t.id_type_evenement) {
            <option [ngValue]="t.id_type_evenement">{{ t.libelle }}</option>
          }
        </select>
        <label for="theme-evenement">Thème</label
        ><select id="theme-evenement" name="id_theme" [(ngModel)]="formulaire.id_theme">
          <option [ngValue]="null">Sans thème</option>
          @for (t of themes(); track t.id_theme) {
            <option [ngValue]="t.id_theme">{{ t.libelle }}</option>
          }
        </select>
        <label for="debut-evenement">Début</label
        ><input
          id="debut-evenement"
          type="datetime-local"
          name="date_debut"
          required
          [(ngModel)]="formulaire.date_debut"
        />
        <label for="fin-evenement">Fin</label
        ><input
          id="fin-evenement"
          type="datetime-local"
          name="date_fin"
          required
          [(ngModel)]="formulaire.date_fin"
        />
        <label for="lieu-evenement">Lieu</label
        ><input
          id="lieu-evenement"
          name="lieu"
          required
          maxlength="2000"
          [(ngModel)]="formulaire.lieu"
        />
        <label for="statut-evenement">Statut</label
        ><select
          id="statut-evenement"
          name="statut_evenement"
          [(ngModel)]="formulaire.statut_evenement"
        >
          @for (s of statutsDisponibles(); track s) {
            <option [value]="s">{{ libelles[s] }}</option>
          }
        </select>
        <label for="image-evenement">Image HTTPS facultative</label
        ><input
          id="image-evenement"
          name="image_url"
          type="url"
          maxlength="2000"
          [(ngModel)]="formulaire.image_url"
        />
        <label for="visible-evenement"
          ><input
            id="visible-evenement"
            name="visible_public"
            type="checkbox"
            [(ngModel)]="formulaire.visible_public"
          />
          Visible publiquement avec l'accord du client</label
        >
        <button type="submit" [disabled]="envoi()">Enregistrer l'événement</button>
        <button type="button" (click)="edition.set(false)">Annuler</button>
      </form>
    }
  </section>`,
})
export class EvenementsGestion {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthentificationService);
  protected readonly libelles = LIBELLES;
  protected readonly evenements = signal<Evenement[]>([]);
  protected readonly selection = signal<Evenement | null>(null);
  protected readonly clients = signal<Client[]>([]);
  protected readonly comptes = signal<Compte[]>([]);
  protected readonly types = signal<{ id_type_evenement: number; libelle: string }[]>([]);
  protected readonly themes = signal<{ id_theme: number; libelle: string }[]>([]);
  protected readonly erreur = signal('');
  protected readonly message = signal('');
  protected readonly envoi = signal(false);
  protected readonly edition = signal(false);
  protected id_evenement = '';
  protected id_client = '';
  protected formulaire = {
    nom: '',
    id_type_evenement: 1,
    id_theme: null as number | null,
    date_debut: '',
    date_fin: '',
    lieu: '',
    statut_evenement: 'brouillon',
    image_url: '',
    visible_public: false,
  };
  constructor() {
    void this.charger();
  }
  protected admin() {
    return this.auth.utilisateur()?.role === 'admin';
  }
  protected async charger() {
    try {
      this.evenements.set(await this.api.get<Evenement[]>('/evenements'));
      this.types.set(await this.api.get('/types-evenement'));
      this.themes.set(await this.api.get('/themes'));
      if (this.admin()) {
        this.clients.set(await this.api.get('/clients'));
        this.comptes.set(await this.api.get('/comptes'));
      }
      const id = this.route.snapshot.queryParamMap.get('id');
      if (id && !this.selection()) await this.ouvrir(id);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected async ouvrir(id: string) {
    try {
      this.selection.set(await this.api.get<Evenement>('/evenements/' + encodeURIComponent(id)));
      this.edition.set(false);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected nouveau() {
    this.id_evenement = '';
    this.id_client = '';
    this.formulaire = {
      nom: '',
      id_type_evenement: this.types()[0]?.id_type_evenement ?? 1,
      id_theme: null,
      date_debut: '',
      date_fin: '',
      lieu: '',
      statut_evenement: 'brouillon',
      image_url: '',
      visible_public: false,
    };
    this.edition.set(true);
  }
  protected modifier(e: Evenement) {
    this.id_evenement = e.id_evenement;
    this.formulaire = {
      nom: e.nom,
      id_type_evenement: e.id_type_evenement,
      id_theme: e.id_theme,
      date_debut: this.locale(e.date_debut),
      date_fin: this.locale(e.date_fin),
      lieu: e.lieu,
      statut_evenement: e.statut_evenement,
      image_url: e.image_url ?? '',
      visible_public: e.visible_public,
    };
    this.edition.set(true);
  }
  private locale(v: string) {
    const d = new Date(v);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  protected typeLibelle(id: number) {
    return this.types().find((t) => t.id_type_evenement === id)?.libelle ?? id;
  }
  protected themeLibelle(id: number | null) {
    return this.themes().find((t) => t.id_theme === id)?.libelle ?? id ?? 'Sans thème';
  }
  protected statutsDisponibles() {
    const s = this.selection()?.statut_evenement ?? 'brouillon';
    return this.id_evenement
      ? (
          {
            brouillon: ['brouillon', 'accepte', 'annule'],
            accepte: ['accepte', 'en_cours', 'annule'],
            en_cours: ['en_cours', 'termine', 'annule'],
            termine: ['termine'],
            annule: ['annule'],
          } as Record<string, string[]>
        )[s]
      : ['brouillon', 'accepte'];
  }
  protected async enregistrer() {
    if (this.envoi()) return;
    this.envoi.set(true);
    this.erreur.set('');
    try {
      const d = {
        ...this.formulaire,
        date_debut: new Date(this.formulaire.date_debut).toISOString(),
        date_fin: new Date(this.formulaire.date_fin).toISOString(),
        image_url: this.formulaire.image_url || null,
      };
      const e = await this.api.modifier<{ id_evenement?: string }>(
        this.id_evenement ? 'PATCH' : 'POST',
        this.id_evenement ? '/evenements/' + this.id_evenement : '/evenements',
        this.id_evenement ? d : { ...d, id_client: this.id_client, id_prospect: null },
      );
      await this.charger();
      await this.ouvrir(this.id_evenement || e.id_evenement!);
      this.message.set('Événement enregistré.');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
  protected async supprimer(e: Evenement) {
    if (!confirm('Supprimer cet événement ? La suppression sera refusée s’il possède un devis.'))
      return;
    if (this.envoi()) return;
    this.envoi.set(true);
    try {
      await this.api.modifier('DELETE', '/evenements/' + e.id_evenement);
      this.selection.set(null);
      await this.charger();
      this.message.set('Événement supprimé.');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
