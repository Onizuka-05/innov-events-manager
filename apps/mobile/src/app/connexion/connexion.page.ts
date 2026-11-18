import { Component, inject, signal, type OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular';

import { ApiService, messageErreur } from '../core/api.service';
import { AuthentificationService } from '../core/authentification.service';
/** Connexion de l'equipe et renouvellement d'un mot de passe temporaire a usage unique. */
@Component({
  selector: 'app-connexion',
  imports: [ReactiveFormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent],
  templateUrl: './connexion.page.html',
})
export class ConnexionPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthentificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly mode = this.route.snapshot.data['mode'] as
    'connexion' | 'oubli' | 'changement';
  protected readonly titre =
    this.mode === 'changement'
      ? 'Nouveau mot de passe'
      : this.mode === 'oubli'
        ? 'Mot de passe oublié'
        : 'Connexion de l’équipe';
  protected readonly formulaire = new FormGroup({
    email_connexion: new FormControl('', {
      nonNullable: true,
      validators:
        this.mode === 'changement'
          ? []
          : [Validators.required, Validators.email, Validators.maxLength(255)],
    }),
    mot_de_passe: new FormControl('', {
      nonNullable: true,
      validators: this.mode === 'oubli' ? [] : [Validators.required, Validators.maxLength(256)],
    }),
  });
  protected readonly erreur = signal('');
  protected readonly message = signal('');
  protected readonly envoi = signal(false);
  async ngOnInit(): Promise<void> {
    try {
      await this.auth.charger();
      if (this.auth.restreinte() && this.mode !== 'changement')
        await this.router.navigateByUrl('/nouveau-mot-de-passe');
      else if (this.auth.utilisateur() && this.mode !== 'oubli') await this.acceder();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  private async acceder() {
    if (['admin', 'employe'].includes(this.auth.utilisateur()?.role ?? '')) {
      await this.router.navigateByUrl('/home');
    } else {
      await this.auth.deconnecter();
      this.erreur.set('Cet espace est réservé aux employés et à l’administrateur.');
    }
  }
  protected async envoyer(): Promise<void> {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid || this.envoi()) return;
    this.envoi.set(true);
    this.erreur.set('');
    this.message.set('');
    try {
      const d = this.formulaire.getRawValue();
      if (this.mode === 'oubli') {
        const r = await this.api.modifier<{ message: string }>('POST', '/mots-de-passe-oublies', {
          email_connexion: d.email_connexion,
        });
        this.message.set(r.message);
      } else if (this.mode === 'changement') {
        await this.api.modifier('PATCH', '/mot-de-passe', { mot_de_passe: d.mot_de_passe });
        await this.auth.charger();
        await this.acceder();
      } else {
        await this.auth.connecter(d);
        if (this.auth.restreinte()) await this.router.navigateByUrl('/nouveau-mot-de-passe');
        else await this.acceder();
      }
      this.formulaire.controls.mot_de_passe.reset();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
  protected async annuler(): Promise<void> {
    if (this.envoi()) return;
    this.envoi.set(true);
    try {
      await this.auth.deconnecter();
      await this.router.navigateByUrl('/mot-de-passe-oublie');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
