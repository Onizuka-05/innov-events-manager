import { Component, computed, input, signal } from '@angular/core';
/** Couverture avec texte alternatif et repli si aucune image HTTPS ne peut etre affichee. */
@Component({
  selector: 'app-image-evenement',
  styleUrl: './catalogue.css',
  template: `@if (afficher()) {
      <img
        class="couverture"
        [src]="url()"
        [alt]="'Événement : ' + nom()"
        loading="lazy"
        referrerpolicy="no-referrer"
        (error)="echec.set(url())"
      />
    } @else {
      <div class="image-repli" aria-hidden="true">Innov’Events</div>
    }`,
})
export class ImageEvenement {
  readonly url = input<string | null>(null);
  readonly nom = input.required<string>();
  protected readonly echec = signal<string | null>(null);
  protected readonly afficher = computed(
    () => !!this.url()?.startsWith('https://') && this.url() !== this.echec(),
  );
}
