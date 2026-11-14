import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Ecran de repli pour toute adresse inconnue. */
@Component({
  selector: 'app-page-introuvable',
  imports: [RouterLink],
  template: `<div class="conteneur page page-legale">
    <p class="surtitre">Erreur 404</p>
    <h1>Page introuvable</h1>
    <p>Cette adresse ne correspond à aucune page du site.</p>
    <a class="bouton bouton-primaire" routerLink="/">Retour à l’accueil</a>
  </div>`,
})
export class PageIntrouvable {}
