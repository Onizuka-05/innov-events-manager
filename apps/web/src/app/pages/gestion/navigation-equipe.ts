import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthentificationService } from '../../core/authentification.service';

const RUBRIQUES = [
  { chemin: '/administration', libelle: 'Tableau de bord', admin: true },
  { chemin: '/administration/prospects', libelle: 'Prospects', admin: true },
  { chemin: '/administration/clients', libelle: 'Clients', admin: false },
  { chemin: '/administration/evenements', libelle: 'Événements', admin: false },
  { chemin: '/administration/devis', libelle: 'Devis', admin: true },
  { chemin: '/administration/taches', libelle: 'Tâches', admin: false },
  { chemin: '/administration/avis', libelle: 'Avis', admin: false },
  { chemin: '/administration/comptes', libelle: 'Comptes', admin: true },
  { chemin: '/administration/journaux', libelle: 'Journaux', admin: true },
  { chemin: '/administration/parametres', libelle: 'Paramètres', admin: true },
];

/** Menu filtre par role ; les gardes et l'API controlent aussi l'acces. */
@Component({
  selector: 'app-navigation-equipe',
  imports: [RouterLink, RouterLinkActive],
  styleUrl: './navigation-equipe.css',
  host: { '(keydown.escape)': 'fermerAuClavier()' },
  template: `@if (equipe()) {
    <nav class="conteneur navigation-equipe" aria-label="Espace équipe">
      <button
        #bouton
        type="button"
        class="bouton-menu-equipe"
        aria-controls="rubriques-equipe"
        [attr.aria-expanded]="ouvert()"
        (click)="ouvert.set(!ouvert())"
      >
        {{ ouvert() ? 'Fermer le menu de l’équipe' : 'Ouvrir le menu de l’équipe' }}
      </button>
      <ul id="rubriques-equipe" [class.ouvert]="ouvert()">
        @for (r of rubriques(); track r.chemin) {
          <li>
            <a
              [routerLink]="r.chemin"
              routerLinkActive="actif"
              [routerLinkActiveOptions]="{
                paths: 'exact',
                queryParams: 'ignored',
                fragment: 'ignored',
                matrixParams: 'ignored',
              }"
              ariaCurrentWhenActive="page"
              (click)="choisir()"
              >{{ r.libelle === 'Tâches' && !admin() ? 'Mes tâches' : r.libelle }}</a
            >
          </li>
        }
      </ul>
    </nav>
  }`,
})
export class NavigationEquipe {
  private readonly auth = inject(AuthentificationService);
  private readonly bouton = viewChild<ElementRef<HTMLButtonElement>>('bouton');
  protected readonly ouvert = signal(false);
  protected admin() {
    return this.auth.utilisateur()?.role === 'admin';
  }
  protected equipe() {
    return ['admin', 'employe'].includes(this.auth.utilisateur()?.role ?? '');
  }
  protected rubriques() {
    return RUBRIQUES.filter((r) => this.admin() || !r.admin);
  }
  /** Rend le focus avant de masquer les liens du menu compact. */
  protected choisir() {
    if (this.ouvert()) {
      this.bouton()?.nativeElement.focus();
      this.ouvert.set(false);
    }
  }
  /** Echap ferme le menu et rend le focus a son bouton. */
  protected fermerAuClavier() {
    this.choisir();
  }
}
