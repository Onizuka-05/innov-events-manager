import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, messageErreur } from '../../core/api.service';
import { type Compte, type Client, LIBELLES } from '../../core/gestion.models';
import { BadgeStatut } from '../../core/badge-statut';
/** Gestion des comptes clients et employes ; administrateur protege par l'API. */
@Component({
  selector: 'app-comptes',
  imports: [FormsModule, BadgeStatut],
  styleUrl: './gestion.css',
  template: ` <section class="conteneur page gestion">
    <h1>Comptes</h1>
    @if (erreur()) {
      <p role="alert" class="erreur">{{ erreur() }}</p>
    }
    @if (message()) {
      <p role="status">{{ message() }}</p>
    }
    <ul class="liste">
      @for (u of comptes(); track u.id_utilisateur) {
        <li>
          <p class="meta">
            <strong>{{ u.prenom }} {{ u.nom }}</strong>
            <span>{{ libelles[u.role] }}</span>
            <app-badge-statut [statut]="u.statut_compte" />
          </p>
          <p class="texte-secondaire">{{ u.nom_utilisateur }} · {{ u.email_connexion }}</p>
          @if (u.role !== 'admin' && u.statut_compte !== 'supprime') {
            <div class="actions">
              <button
                type="button"
                class="bouton-secondaire"
                [disabled]="envoi()"
                (click)="statut(u)"
              >
                {{ u.statut_compte === 'actif' ? 'Suspendre' : 'Réactiver' }}
                <span class="visuellement-cache">{{ u.prenom }} {{ u.nom }}</span></button
              ><button
                type="button"
                class="bouton-danger"
                [disabled]="envoi()"
                (click)="supprimer(u)"
              >
                Supprimer <span class="visuellement-cache">{{ u.prenom }} {{ u.nom }}</span>
              </button>
            </div>
          }
        </li>
      }
    </ul>
    <form class="formulaire carte bloc" (ngSubmit)="creer()">
      <h2>Créer un compte</h2>
      <label for="role-compte">Rôle</label
      ><select
        id="role-compte"
        name="role"
        [(ngModel)]="formulaire.role"
        (ngModelChange)="formulaire.id_client = ''"
        required
      >
        <option value="employe">Employé</option>
        <option value="client">Client</option>
      </select>
      @for (c of champs; track c.cle) {
        <label [for]="'compte-' + c.cle">{{ c.label }}</label><input
          [id]="'compte-' + c.cle"
          [name]="c.cle"
          [type]="c.type"
          [maxlength]="c.max"
          autocomplete="off"
          required
          [(ngModel)]="formulaire[c.cle]"
        />
      }
      <p>
        Le titulaire reçoit par e-mail un mot de passe temporaire valable 7 jours. Il choisit son
        propre mot de passe à la première connexion.
      </p>
      @if (formulaire.role === 'client') {
        <label for="fiche-compte">Rattacher à une fiche client (facultatif)</label
        ><select id="fiche-compte" name="id_client" [(ngModel)]="formulaire.id_client">
          <option value="">Sans fiche</option>
          @for (c of clients(); track c.id_client) {
            @if (!c.id_utilisateur && !c.date_anonymisation) {
              <option [value]="c.id_client">{{ c.entreprise }}</option>
            }
          }
        </select>
      }
      <button type="submit" class="bouton-primaire" [disabled]="envoi()">Créer le compte</button>
    </form>
  </section>`,
})
export class Comptes {
  private readonly api = inject(ApiService);
  protected readonly comptes = signal<Compte[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly erreur = signal('');
  protected readonly message = signal('');
  protected readonly envoi = signal(false);
  protected readonly libelles = LIBELLES;
  protected formulaire = {
    role: 'employe',
    email_connexion: '',
    nom_utilisateur: '',
    prenom: '',
    nom: '',
    id_client: '',
  };
  protected readonly champs: {
    cle: 'email_connexion' | 'nom_utilisateur' | 'prenom' | 'nom';
    label: string;
    type: string;
    max: number;
  }[] = [
    { cle: 'email_connexion', label: 'E-mail', type: 'email', max: 255 },
    { cle: 'nom_utilisateur', label: 'Nom d’utilisateur', type: 'text', max: 100 },
    { cle: 'prenom', label: 'Prénom', type: 'text', max: 120 },
    { cle: 'nom', label: 'Nom', type: 'text', max: 120 },
  ];
  constructor() {
    void this.charger();
  }
  private async charger() {
    try {
      this.comptes.set(await this.api.get('/comptes'));
      this.clients.set(await this.api.get('/clients'));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  private async operation(fn: () => Promise<unknown>) {
    if (this.envoi()) return;
    this.envoi.set(true);
    this.erreur.set('');
    this.message.set('');
    try {
      await fn();
      this.message.set('Compte mis à jour.');
      await this.charger();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
  protected creer() {
    return this.operation(async () => {
      await this.api.modifier('POST', '/comptes', {
        ...this.formulaire,
        id_client: this.formulaire.id_client || null,
      });
      this.formulaire.email_connexion = '';
      this.formulaire.nom_utilisateur = '';
      this.formulaire.id_client = '';
    });
  }
  protected statut(u: Compte) {
    return this.operation(() =>
      this.api.modifier('POST', '/comptes/' + u.id_utilisateur + '/statut', {
        statut_compte: u.statut_compte === 'actif' ? 'suspendu' : 'actif',
      }),
    );
  }
  protected supprimer(u: Compte) {
    if (
      !confirm(
        u.role === 'employe'
          ? 'Supprimer cet employé ? Ses tâches non terminées vous seront réaffectées et ses notes seront conservées.'
          : 'Supprimer ce compte client et anonymiser sa fiche ? Ses événements et devis seront conservés.',
      )
    )
      return;
    return this.operation(() => this.api.modifier('DELETE', '/comptes/' + u.id_utilisateur));
  }
}
