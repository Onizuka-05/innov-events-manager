import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationEquipe } from './navigation-equipe';

/**
 * Navigation partagee par toutes les rubriques de l'equipe. La classe d'hote porte la
 * presentation commune de l'espace (cartes, boutons, tableaux) definie dans styles.css.
 */
@Component({
  selector: 'app-espace-equipe',
  imports: [NavigationEquipe, RouterOutlet],
  host: { class: 'espace-equipe' },
  template: `<app-navigation-equipe /><router-outlet />`,
})
export class EspaceEquipe {}
