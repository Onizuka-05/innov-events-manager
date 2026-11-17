import { Component, computed, input } from '@angular/core';
import { familleStatut, libelleStatut } from './statuts';

/**
 * Etiquette de statut : libelle ecrit en clair sur le fond de sa famille (CO-09).
 * La couleur accompagne le texte et ne porte jamais seule l'information.
 */
@Component({
  selector: 'app-badge-statut',
  template: `<span [class]="'statut statut-' + famille()">{{ libelle() }}</span>`,
})
export class BadgeStatut {
  readonly statut = input.required<string>();
  protected readonly famille = computed(() => familleStatut(this.statut()));
  protected readonly libelle = computed(() => libelleStatut(this.statut()));
}
