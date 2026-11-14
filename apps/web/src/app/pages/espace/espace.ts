import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthentificationService } from '../../core/authentification.service';
import { messageErreur } from '../../core/api.service';

/** Point d'entree protege pour les espaces qui seront enrichis avec leurs fonctions. */
@Component({
  selector: 'app-espace',
  imports: [RouterLink],
  template: ` <section class="conteneur page">
    <h1>Mon espace</h1>
    <p>Bonjour {{ auth.utilisateur()?.prenom }}.</p>
    @if (auth.utilisateur()?.role === 'admin') {
      <p><a routerLink="/administration/remerciement">Modifier le message de remerciement</a></p>
    }
    <button type="button" [disabled]="envoi()" (click)="deconnecter()">Se déconnecter</button>
    @if (erreur()) {
      <p role="alert">{{ erreur() }}</p>
    }
  </section>`,
})
export class Espace {
  protected readonly auth = inject(AuthentificationService);
  private readonly router = inject(Router);
  protected readonly erreur = signal('');
  protected readonly envoi = signal(false);
  protected async deconnecter(): Promise<void> {
    if (this.envoi()) return;
    this.envoi.set(true);
    try {
      await this.auth.deconnecter();
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
