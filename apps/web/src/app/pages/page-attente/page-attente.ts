import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

/** Route transitoire, remplacee par la fonctionnalite du lot concerne. */
@Component({
  selector: 'app-page-attente',
  imports: [RouterLink],
  template: `<div class="conteneur page page-legale">
    <p class="surtitre">Démonstration</p>
    <h1>{{ donnees()?.['titre'] }}</h1>
    <p class="avis-demo">{{ donnees()?.['description'] }}</p>
    <a class="bouton bouton-secondaire" routerLink="/">Retour à l’accueil</a>
  </div>`,
})
export class PageAttente {
  protected readonly donnees = toSignal(inject(ActivatedRoute).data);
}
