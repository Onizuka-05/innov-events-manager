import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

/** Gabarit commun aux pages publiques. La session sera raccordee avec AUTH-02. */
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  host: { '(document:keydown.escape)': 'fermerMenuAuClavier()' },
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly menuOuvert = signal(false);
  private readonly contenu = viewChild<ElementRef<HTMLElement>>('contenu');
  private readonly boutonMenu = viewChild<ElementRef<HTMLButtonElement>>('boutonMenu');
  private navigationInitiale = true;

  constructor() {
    inject(Router)
      .events.pipe(
        filter((evenement): evenement is NavigationEnd => evenement instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.fermerMenu();
        if (this.navigationInitiale) {
          this.navigationInitiale = false;
        } else {
          this.contenu()?.nativeElement.focus({ preventScroll: true });
        }
      });
  }

  /** Atteint le contenu sans suivre la base URL des liens fragmentaires. */
  protected allerAuContenu(evenement: Event): void {
    evenement.preventDefault();
    this.contenu()?.nativeElement.focus();
  }

  /** Ouvre ou ferme la navigation sur petit ecran. */
  protected basculerMenu(): void {
    this.menuOuvert.update((ouvert) => !ouvert);
  }

  /** Ferme la navigation apres un choix ou avec la touche Echap. */
  protected fermerMenu(): void {
    this.menuOuvert.set(false);
  }

  /** Rend le focus au bouton avant de masquer les liens du menu mobile. */
  protected fermerMenuAuClavier(): void {
    if (this.menuOuvert()) {
      this.fermerMenu();
      this.boutonMenu()?.nativeElement.focus();
    }
  }
}
