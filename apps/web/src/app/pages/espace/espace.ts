import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { OPTIONS_RUBRIQUE_ACTIVE } from '../../core/rubriques-equipe';
/** Menu permanent du client, avec une page par rubrique. */
@Component({
  selector: 'app-espace',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styleUrl: './espace-client.css',
  template: `<div class="espace-client">
    <nav class="conteneur navigation-client" aria-label="Espace client">
      <ul>
        @for (r of rubriques; track r.chemin) {
          <li>
            <a
              [routerLink]="r.chemin"
              routerLinkActive="actif"
              [routerLinkActiveOptions]="options"
              ariaCurrentWhenActive="page"
              >{{ r.libelle }}</a
            >
          </li>
        }
      </ul>
    </nav>
    <router-outlet />
  </div>`,
})
export class Espace {
  protected readonly options = OPTIONS_RUBRIQUE_ACTIVE;
  protected readonly rubriques = [
    { chemin: '/espace', libelle: 'Accueil' },
    { chemin: '/espace/devis', libelle: 'Mes devis' },
    { chemin: '/espace/evenements', libelle: 'Mes événements' },
    { chemin: '/espace/profil', libelle: 'Mon profil' },
  ];
}
