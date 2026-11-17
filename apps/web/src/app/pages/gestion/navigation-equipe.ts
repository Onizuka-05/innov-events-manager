import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthentificationService } from '../../core/authentification.service';
import { OPTIONS_RUBRIQUE_ACTIVE, rubriquesEquipe } from '../../core/rubriques-equipe';

/**
 * Menu de l'equipe en boutons, filtre par role ; les gardes et l'API controlent aussi l'acces.
 * Sur petit ecran, ces rubriques sont placees en tete du menu unique de l'en-tete.
 */
@Component({
  selector: 'app-navigation-equipe',
  imports: [RouterLink, RouterLinkActive],
  styleUrl: './navigation-equipe.css',
  template: `@if (rubriques().length) {
    <nav class="conteneur navigation-equipe" aria-label="Espace équipe">
      <ul>
        @for (r of rubriques(); track r.chemin) {
          <li>
            <a
              [routerLink]="r.chemin"
              routerLinkActive="actif"
              [routerLinkActiveOptions]="optionsRubrique"
              ariaCurrentWhenActive="page"
              >{{ r.libelle }}</a
            >
          </li>
        }
      </ul>
    </nav>
  }`,
})
export class NavigationEquipe {
  private readonly auth = inject(AuthentificationService);
  protected readonly optionsRubrique = OPTIONS_RUBRIQUE_ACTIVE;
  protected rubriques() {
    return rubriquesEquipe(this.auth.utilisateur()?.role);
  }
}
