import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationEquipe } from './navigation-equipe';

/** Navigation partagee par toutes les rubriques de l'equipe. */
@Component({
  selector: 'app-espace-equipe',
  imports: [NavigationEquipe, RouterOutlet],
  template: `<app-navigation-equipe /><router-outlet />`,
})
export class EspaceEquipe {}
