import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';
import { LIBELLES, type Note, type Tache, type Compte } from '../../core/gestion.models';

/** Edition des notes et progression des seules taches affectees au compte courant. */
@Component({
  selector: 'app-notes-taches',
  styleUrl: './gestion.css',
  imports: [FormsModule, DatePipe],
  template: `
    <section class="carte bloc">
      <h2>{{ id_evenement() ? 'Notes du projet' : 'Notes globales' }}</h2>
      @if (erreur()) {
        <p role="alert" class="erreur">{{ erreur() }}</p>
      }
      @if (message()) {
        <p role="status">{{ message() }}</p>
      }
      @for (n of notes(); track n.id_note) {
        <article class="carte">
          <p>{{ n.contenu }}</p>
          <p class="texte-secondaire">
            {{ n.prenom }} {{ n.nom }} · {{ n.date_creation | date: 'short' }}
          </p>
          @if (admin() || n.id_utilisateur === auth.utilisateur()?.id_utilisateur) {
            <button type="button" (click)="editer(n)">Modifier la note</button>
            <button type="button" (click)="supprimer(n)">Supprimer la note</button>
          }
        </article>
      } @empty {
        <p>Aucune note.</p>
      }
      <form class="formulaire" (ngSubmit)="enregistrer()">
        <label [for]="'contenu-note-' + (id_evenement() || 'global')">{{
          id_note ? 'Modifier la note' : 'Nouvelle note'
        }}</label>
        <textarea
          [id]="'contenu-note-' + (id_evenement() || 'global')"
          name="contenu"
          required
          maxlength="5000"
          rows="3"
          [(ngModel)]="contenu"
        ></textarea>
        <button type="submit" [disabled]="envoi()">Enregistrer la note</button>
        @if (id_note) {
          <button type="button" (click)="annuler()">Annuler la modification</button>
        }
      </form>
    </section>
    @if (id_evenement()) {
      <section class="carte bloc">
        <h2>Tâches</h2>
        @for (t of taches(); track t.id_tache) {
          <article class="carte">
            <h3>{{ t.titre }}</h3>
            <p>{{ t.description }}</p>
            <p>
              {{ t.prenom }} {{ t.nom }} · {{ libelles[t.statut_tache] }} ·
              {{ t.date_echeance | date: 'short' }}
            </p>
            @if (
              t.id_utilisateur === auth.utilisateur()?.id_utilisateur &&
              t.statut_tache !== 'termine'
            ) {
              <button type="button" [disabled]="envoi()" (click)="avancer(t)">
                {{ t.statut_tache === 'a_faire' ? 'Démarrer' : 'Terminer' }}
              </button>
            }
            @if (admin() && t.statut_tache !== 'termine') {
              <label [for]="'affecte-' + t.id_tache">Réaffecter à</label
              ><select
                [id]="'affecte-' + t.id_tache"
                [value]="t.id_utilisateur"
                (change)="affecter(t, $event)"
              >
                @for (u of affectables(); track u.id_utilisateur) {
                  <option [value]="u.id_utilisateur">{{ u.prenom }} {{ u.nom }}</option>
                }
              </select>
            }
          </article>
        } @empty {
          <p>Aucune tâche.</p>
        }
        @if (admin()) {
          <form class="formulaire" (ngSubmit)="creerTache()">
            <h3>Créer une tâche</h3>
            <label for="titre-tache">Titre</label
            ><input id="titre-tache" name="titre" required maxlength="255" [(ngModel)]="titre" />
            <label for="description-tache">Description</label
            ><textarea
              id="description-tache"
              name="description"
              maxlength="3000"
              [(ngModel)]="description"
            ></textarea>
            <label for="affectation-tache">Affecter à</label
            ><select
              id="affectation-tache"
              name="id_utilisateur"
              required
              [(ngModel)]="id_utilisateur"
            >
              <option value="">Choisir</option>
              @for (u of affectables(); track u.id_utilisateur) {
                <option [value]="u.id_utilisateur">{{ u.prenom }} {{ u.nom }}</option>
              }
            </select>
            <label for="echeance-tache">Échéance facultative</label
            ><input
              id="echeance-tache"
              name="date_echeance"
              type="datetime-local"
              [(ngModel)]="date_echeance"
            />
            <button type="submit" [disabled]="envoi()">Créer la tâche</button>
          </form>
        }
      </section>
    }
  `,
})
export class NotesTaches {
  protected readonly auth = inject(AuthentificationService);
  private readonly api = inject(ApiService);
  readonly id_evenement = input<string | null>(null);
  readonly notes = input<Note[]>([]);
  readonly taches = input<Tache[]>([]);
  readonly comptes = input<Compte[]>([]);
  readonly changement = output<void>();
  protected readonly libelles = LIBELLES;
  protected readonly erreur = signal('');
  protected readonly message = signal('');
  protected readonly envoi = signal(false);
  protected contenu = '';
  protected id_note = '';
  protected titre = '';
  protected description = '';
  protected id_utilisateur = '';
  protected date_echeance = '';
  constructor() {
    effect(() => {
      this.id_evenement();
      untracked(() => {
        this.annuler();
        this.titre = '';
        this.description = '';
        this.id_utilisateur = '';
        this.date_echeance = '';
      });
    });
  }
  protected admin() {
    return this.auth.utilisateur()?.role === 'admin';
  }
  protected affectables() {
    return this.comptes().filter(
      (u) => ['admin', 'employe'].includes(u.role) && u.statut_compte === 'actif',
    );
  }
  protected editer(n: Note) {
    this.id_note = n.id_note;
    this.contenu = n.contenu;
  }
  protected annuler() {
    this.id_note = '';
    this.contenu = '';
  }
  private async operation(fn: () => Promise<unknown>) {
    if (this.envoi()) return;
    this.envoi.set(true);
    this.erreur.set('');
    this.message.set('');
    try {
      await fn();
      this.message.set('Enregistré.');
      this.changement.emit();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
  protected enregistrer() {
    return this.operation(async () => {
      await this.api.modifier(
        this.id_note ? 'PATCH' : 'POST',
        this.id_note ? '/notes/' + this.id_note : '/notes',
        this.id_note
          ? { contenu: this.contenu }
          : { id_evenement: this.id_evenement(), contenu: this.contenu },
      );
      this.annuler();
    });
  }
  protected supprimer(n: Note) {
    if (!confirm('Supprimer cette note ?')) return;
    return this.operation(() => this.api.modifier('DELETE', '/notes/' + n.id_note));
  }
  protected avancer(t: Tache) {
    return this.operation(() =>
      this.api.modifier('POST', '/taches/' + t.id_tache + '/statut', {
        statut_tache: t.statut_tache === 'a_faire' ? 'en_cours' : 'termine',
      }),
    );
  }
  protected affecter(t: Tache, e: Event) {
    return this.operation(() =>
      this.api.modifier('POST', '/taches/' + t.id_tache + '/affectation', {
        id_utilisateur: (e.target as HTMLSelectElement).value,
      }),
    );
  }
  protected creerTache() {
    return this.operation(async () => {
      await this.api.modifier('POST', '/taches', {
        id_evenement: this.id_evenement(),
        id_utilisateur: this.id_utilisateur,
        titre: this.titre,
        description: this.description,
        date_echeance: this.date_echeance ? new Date(this.date_echeance).toISOString() : null,
      });
      this.titre = '';
      this.description = '';
    });
  }
}
