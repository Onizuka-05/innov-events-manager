import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';
import { type Client, LIBELLES } from '../../core/gestion.models';

/** Recherche des clients et historique ; formulaires reserves a l'administrateur. */
@Component({
  selector: 'app-clients',
  imports: [FormsModule, RouterLink, DatePipe],
  styleUrl: './gestion.css',
  template: ` <section class="conteneur page gestion">
    <h1>Clients</h1>
    @if (erreur()) {
      <p class="erreur" role="alert">{{ erreur() }}</p>
    }
    @if (message()) {
      <p role="status">{{ message() }}</p>
    }
    <form class="formulaire" (ngSubmit)="charger()">
      <label for="recherche-client">Rechercher une entreprise ou un contact</label
      ><input
        id="recherche-client"
        name="recherche"
        type="search"
        maxlength="200"
        [(ngModel)]="recherche"
      /><button type="submit">Rechercher</button>
    </form>
    @if (admin()) {
      <button type="button" (click)="nouveau()">Créer un client</button>
    }
    <ul class="liste">
      @for (c of clients(); track c.id_client) {
        <li>
          <button type="button" (click)="ouvrir(c.id_client)">
            {{ c.entreprise || 'Client anonymisé' }} — {{ c.prenom_contact }} {{ c.nom_contact }}
          </button>
        </li>
      } @empty {
        <li>Aucun client.</li>
      }
    </ul>
    @if (selection(); as c) {
      <section class="carte bloc">
        <h2>{{ c.entreprise || 'Client anonymisé' }}</h2>
        <dl>
          <dt>Contact</dt>
          <dd>{{ c.prenom_contact }} {{ c.nom_contact }}</dd>
          <dt>E-mail</dt>
          <dd>{{ c.email_contact || '—' }}</dd>
          <dt>Téléphone</dt>
          <dd>{{ c.telephone || '—' }}</dd>
          <dt>Adresse</dt>
          <dd>{{ c.adresse_postale || '—' }}</dd>
        </dl>
        @if (admin() && !c.date_anonymisation) {
          <button type="button" (click)="modifier(c)">Modifier la fiche</button>
          <button type="button" [disabled]="envoi()" (click)="supprimer(c)">
            Supprimer et anonymiser le client
          </button>
        }
        <h3>Historique des événements</h3>
        <ul>
          @for (e of c.evenements; track e.id_evenement) {
            <li>
              <a
                [routerLink]="['/administration/evenements']"
                [queryParams]="{ id: e.id_evenement }"
                >{{ e.nom }}</a
              >
              · {{ e.date_debut | date: 'short' }} · {{ libelles[e.statut_evenement] }}
            </li>
          } @empty {
            <li>Aucun événement.</li>
          }
        </ul>
      </section>
    }
    @if (edition()) {
      <form class="formulaire carte bloc" (ngSubmit)="enregistrer()">
        <h2>{{ id_client ? 'Modifier le client' : 'Créer un client' }}</h2>
        @for (c of champs; track c.cle) {
          <label [for]="'client-' + c.cle">{{ c.label }}</label><input
            [id]="'client-' + c.cle"
            [name]="c.cle"
            [type]="c.type"
            [maxlength]="c.max"
            required
            [(ngModel)]="formulaire[c.cle]"
          />
        }
        <button type="submit" [disabled]="envoi()">Enregistrer</button>
        <button type="button" (click)="edition.set(false)">Annuler</button>
      </form>
    }
  </section>`,
})
export class Clients {
  protected readonly auth = inject(AuthentificationService);
  private readonly api = inject(ApiService);
  protected readonly clients = signal<Client[]>([]);
  protected readonly selection = signal<Client | null>(null);
  protected readonly erreur = signal('');
  protected readonly message = signal('');
  protected readonly envoi = signal(false);
  protected readonly edition = signal(false);
  protected readonly libelles = LIBELLES;
  protected recherche = '';
  protected id_client = '';
  protected formulaire = {
    entreprise: '',
    nom_contact: '',
    prenom_contact: '',
    email_contact: '',
    telephone: '',
    adresse_postale: '',
  };
  protected readonly champs: {
    cle: keyof Clients['formulaire'];
    label: string;
    type: string;
    max: number;
  }[] = [
    { cle: 'entreprise', label: 'Entreprise', type: 'text', max: 255 },
    { cle: 'nom_contact', label: 'Nom du contact', type: 'text', max: 120 },
    { cle: 'prenom_contact', label: 'Prénom', type: 'text', max: 120 },
    { cle: 'email_contact', label: 'E-mail', type: 'email', max: 255 },
    { cle: 'telephone', label: 'Téléphone', type: 'tel', max: 35 },
    { cle: 'adresse_postale', label: 'Adresse postale', type: 'text', max: 2000 },
  ];
  constructor() {
    void this.charger();
  }
  protected admin() {
    return this.auth.utilisateur()?.role === 'admin';
  }
  protected async charger() {
    try {
      this.clients.set(
        await this.api.get<Client[]>('/clients?recherche=' + encodeURIComponent(this.recherche)),
      );
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected async ouvrir(id: string) {
    try {
      this.selection.set(await this.api.get<Client>('/clients/' + id));
      this.edition.set(false);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected nouveau() {
    this.id_client = '';
    for (const c of this.champs) this.formulaire[c.cle] = '';
    this.edition.set(true);
  }
  protected modifier(c: Client) {
    this.id_client = c.id_client;
    for (const champ of this.champs) this.formulaire[champ.cle] = c[champ.cle] ?? '';
    this.edition.set(true);
  }
  protected async enregistrer() {
    if (this.envoi()) return;
    this.envoi.set(true);
    this.erreur.set('');
    try {
      const c = await this.api.modifier<{ id_client: string }>(
        this.id_client ? 'PATCH' : 'POST',
        this.id_client ? '/clients/' + this.id_client : '/clients',
        this.formulaire,
      );
      await this.charger();
      await this.ouvrir(c.id_client);
      this.message.set('Fiche enregistrée.');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
  protected async supprimer(c: Client) {
    if (
      !confirm(
        'Supprimer le compte et anonymiser la fiche ? Les événements et devis seront conservés.',
      )
    )
      return;
    if (this.envoi()) return;
    this.envoi.set(true);
    try {
      await this.api.modifier('DELETE', '/clients/' + c.id_client);
      await this.charger();
      await this.ouvrir(c.id_client);
      this.message.set('Client supprimé, fiche anonymisée.');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
