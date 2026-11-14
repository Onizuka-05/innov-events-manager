import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, messageErreur } from '../../core/api.service';

/** Parametre reserve a l'administrateur dans l'interface et dans l'API. */
@Component({
  selector: 'app-remerciement',
  imports: [ReactiveFormsModule],
  template: ` <section class="conteneur page page-formulaire">
    <h1>Message de remerciement</h1>
    <p>Ce texte s’affiche après les prochaines demandes de devis.</p>
    <form class="carte formulaire" (submit)="$event.preventDefault(); enregistrer()">
      <div class="champ">
        <label for="texte_remerciement">Message *</label
        ><textarea
          id="texte_remerciement"
          [formControl]="texte"
          rows="6"
          maxlength="2000"
          required
        ></textarea>
      </div>
      @if (erreur()) {
        <p class="erreur" role="alert">{{ erreur() }}</p>
      }
      @if (message()) {
        <p class="succes" role="status">{{ message() }}</p>
      }
      <button class="bouton-primaire" type="submit" [disabled]="envoi() || !charge()">
        Enregistrer
      </button>
    </form>
  </section>`,
})
export class Remerciement implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly texte = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  protected readonly erreur = signal('');
  protected readonly message = signal('');
  protected readonly envoi = signal(false);
  protected readonly charge = signal(false);
  /** Charge la valeur actuellement enregistree. */
  async ngOnInit(): Promise<void> {
    try {
      this.texte.setValue(
        (await this.api.get<{ texte_remerciement: string }>('/parametres/remerciement'))
          .texte_remerciement,
      );
      this.charge.set(true);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected async enregistrer(): Promise<void> {
    if (this.texte.invalid || !this.texte.value.trim()) {
      this.erreur.set('Renseignez le message.');
      return;
    }
    if (this.envoi()) return;
    this.envoi.set(true);
    this.erreur.set('');
    this.message.set('');
    try {
      this.message.set(
        (
          await this.api.modifier<{ message: string }>('PATCH', '/parametres/remerciement', {
            texte_remerciement: this.texte.value,
          })
        ).message,
      );
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
