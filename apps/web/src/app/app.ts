import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthentificationService } from './core/authentification.service';

/** Gabarit commun aux pages publiques. Navigation adaptee a la session courante. */
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  host: { '(document:keydown.escape)': 'fermerMenuAuClavier()' },
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(AuthentificationService);
  protected readonly menuOuvert = signal(false);
  private readonly contenu = viewChild<ElementRef<HTMLElement>>('contenu');
  private readonly boutonMenu = viewChild<ElementRef<HTMLButtonElement>>('boutonMenu');
  private navigationInitiale = true;

  private readonly router = inject(Router);
  protected readonly deconnexion = signal(false);

  constructor() {
    // Etat d'affichage du menu apres un rechargement ; les droits restent controles par l'API.
    this.auth.charger().catch(() => undefined);
    this.router.events
      .pipe(
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

  /**
   * Ferme le menu mobile apres le choix d'un lien et place le focus sur le contenu,
   * y compris pour la page courante, ou le routeur ne declenche aucune navigation.
   */
  protected choisirLien(): void {
    if (this.menuOuvert()) {
      this.fermerMenu();
      this.contenu()?.nativeElement.focus({ preventScroll: true });
    }
  }

  /** Rend le focus au bouton avant de masquer les liens du menu mobile. */
  protected fermerMenuAuClavier(): void {
    if (this.menuOuvert()) {
      this.fermerMenu();
      this.boutonMenu()?.nativeElement.focus();
    }
  }

  /** Detruit la session cote serveur depuis le menu, puis revient a l'accueil. */
  protected async deconnecter(): Promise<void> {
    if (this.deconnexion()) return;
    this.deconnexion.set(true);
    this.fermerMenu();
    try {
      await this.auth.deconnecter();
      await this.router.navigateByUrl('/');
    } catch {
      // Session conservee : le lien reste disponible pour une nouvelle tentative.
    } finally {
      this.deconnexion.set(false);
    }
  }
}
