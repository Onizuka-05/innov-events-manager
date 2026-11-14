import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';

/** Contact accessible avec ou sans compte. */
@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './contact.html',
})
export class Contact {
  private readonly api = inject(ApiService);
  private readonly utilisateur = inject(AuthentificationService).utilisateur();
  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    nom_utilisateur: [this.utilisateur?.nom_utilisateur ?? '', Validators.maxLength(100)],
    email: [this.utilisateur?.email_connexion ?? '', [Validators.email, Validators.maxLength(255)]],
    titre: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
  });
  protected readonly message = signal('');
  protected readonly erreur = signal('');
  protected readonly envoi = signal(false);

  /** Verification conditionnelle de l'e-mail, repetee cote serveur. */
  protected async envoyer(): Promise<void> {
    this.formulaire.markAllAsTouched();
    this.erreur.set('');
    this.message.set('');
    const d = this.formulaire.getRawValue();
    if (this.formulaire.invalid || (!d.nom_utilisateur.trim() && !d.email.trim())) {
      this.erreur.set('Vérifiez le formulaire. L’e-mail est obligatoire sans nom d’utilisateur.');
      return;
    }
    if (this.envoi()) return;
    this.envoi.set(true);
    try {
      this.message.set(
        (await this.api.modifier<{ message: string }>('POST', '/contacts', d)).message,
      );
      this.formulaire.reset();
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur));
    } finally {
      this.envoi.set(false);
    }
  }
}
