import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, messageErreur } from '../../core/api.service';
import type { Compte } from '../../core/gestion.models';
import { libelleStatut } from '../../core/statuts';

interface Journal {
  horodatage: string;
  type_action: string;
  id_utilisateur: string | null;
  details: Record<string, string | number | null>;
}

/** Libelles des types d'action ; la valeur envoyee au filtre reste le type technique. */
export const TYPES_ACTION: Readonly<Record<string, string>> = {
  CONNEXION_REUSSIE: 'Connexion réussie',
  CONNEXION_ECHOUEE: 'Connexion échouée',
  CREATION_CLIENT: 'Création d’un client',
  MODIFICATION_CLIENT: 'Modification d’un client',
  SUPPRESSION_CLIENT: 'Suppression d’un client',
  CREATION_EVENEMENT: 'Création d’un événement',
  CHANGEMENT_STATUT_EVENEMENT: 'Changement de statut d’un événement',
  GENERATION_PDF: 'Génération du PDF d’un devis',
  ENVOI_DEVIS: 'Envoi d’un devis',
  REPONSE_DEVIS: 'Réponse à un devis',
};

/** Ordre et libelles des details connus ; une cle inconnue reste affichee telle quelle. */
const DETAILS: readonly { cle: string; libelle: string; numero?: boolean; statut?: boolean }[] = [
  { cle: 'nom_client', libelle: 'Client' },
  { cle: 'email', libelle: 'E-mail' },
  { cle: 'id_client', libelle: 'Fiche client', numero: true },
  { cle: 'id_evenement', libelle: 'Événement', numero: true },
  { cle: 'id_devis', libelle: 'Devis', numero: true },
  { cle: 'statut_devis', libelle: 'Réponse', statut: true },
  { cle: 'ip', libelle: 'Adresse IP' },
];

/**
 * Details d'un journal ecrits en texte : « Statut : Brouillon → Accepté · Événement n° 3 ».
 * Aucune donnee n'est ajoutee : seules les valeurs enregistrees sont reformulees.
 */
export function detailsLisibles(details: Journal['details'] | null | undefined): string {
  const d = details ?? {};
  const morceaux: string[] = [];
  if ('ancien' in d || 'nouveau' in d) {
    morceaux.push(
      'Statut : ' +
        libelleStatut(String(d['ancien'] ?? '—')) +
        ' → ' +
        libelleStatut(String(d['nouveau'] ?? '—')),
    );
  }
  for (const { cle, libelle, numero, statut } of DETAILS) {
    if (!(cle in d)) continue;
    const valeur = d[cle] === null || d[cle] === '' ? '—' : String(d[cle]);
    morceaux.push(
      numero
        ? libelle + ' n° ' + valeur
        : libelle + ' : ' + (statut ? libelleStatut(valeur) : valeur),
    );
  }
  const connues = new Set(['ancien', 'nouveau', ...DETAILS.map((x) => x.cle)]);
  for (const [cle, valeur] of Object.entries(d)) {
    if (!connues.has(cle)) morceaux.push(cle + ' : ' + (valeur ?? '—'));
  }
  return morceaux.length ? morceaux.join(' · ') : '—';
}

/** Consultation admin paginee et filtre exact du type d'action. */
@Component({
  selector: 'app-journaux',
  imports: [DatePipe, FormsModule],
  styleUrl: './gestion.css',
  template: `<section class="conteneur page gestion">
    <h1>Journaux</h1>
    @if (erreur()) {
      <p role="alert" class="erreur">{{ erreur() }}</p>
    }
    <form class="formulaire barre-recherche" (ngSubmit)="page = 1; charger()">
      <div class="champ">
        <label for="type-action">Type d'action</label>
        <select id="type-action" name="type_action" [(ngModel)]="type_action">
          <option value="">Tous</option>
          @for (t of types; track t) {
            <option [value]="t">{{ libelleAction(t) }}</option>
          }
        </select>
      </div>
      <button type="submit" class="bouton-secondaire">Filtrer</button>
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
              <td>{{ libelleAction(j.type_action) }}</td>
              <td class="utilisateur">{{ utilisateur(j.id_utilisateur) }}</td>
              <td class="details">{{ details(j) }}</td>
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
      <button
        type="button"
        class="bouton-secondaire"
        [disabled]="page === 1"
        (click)="page = page - 1; charger()"
      >
        Précédent
      </button>
      <button
        type="button"
        class="bouton-secondaire"
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
  /** Comptes indexes par identifiant ; null tant que la liste n'a pas ete lue. */
  private readonly comptes = signal<Map<string, Compte> | null>(null);
  protected type_action = '';
  protected page = 1;
  protected readonly types = Object.keys(TYPES_ACTION);
  constructor() {
    void this.chargerComptes();
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
  /** Les comptes servent seulement a afficher l'identifiant ; un echec laisse le numero. */
  private async chargerComptes() {
    try {
      const liste = await this.api.get<Compte[]>('/comptes');
      this.comptes.set(new Map(liste.map((c): [string, Compte] => [String(c.id_utilisateur), c])));
    } catch {
      this.comptes.set(null);
    }
  }
  protected libelleAction(type: string): string {
    return TYPES_ACTION[type] ?? type;
  }
  /**
   * Identifiant de connexion et nom de l'utilisateur. Un compte absent de la liste a ete
   * supprime ; si la liste n'a pas pu etre lue, seul le numero est affiche.
   */
  protected utilisateur(id: string | null): string {
    if (!id) return '—';
    const comptes = this.comptes();
    if (!comptes) return 'Compte n° ' + id;
    const c = comptes.get(String(id));
    return c ? c.nom_utilisateur + ' (' + c.prenom + ' ' + c.nom + ')' : 'Compte supprimé n° ' + id;
  }
  protected details(j: Journal): string {
    return detailsLisibles(j.details);
  }
}
