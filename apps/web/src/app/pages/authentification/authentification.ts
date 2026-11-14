import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService, retourInterne } from '../../core/authentification.service';

type Mode = 'connexion' | 'inscription' | 'oubli' | 'changement';
interface Champ {
  nom: string;
  label: string;
  type: string;
  autocomplete: string;
  max: number;
}
const ADRESSE: Champ = {
  nom: 'email_connexion',
  label: 'E-mail',
  type: 'email',
  autocomplete: 'email',
  max: 255,
};
const MOT: Champ = {
  nom: 'mot_de_passe',
  label: 'Mot de passe',
  type: 'password',
  autocomplete: 'new-password',
  max: 256,
};

/** Formulaires reactifs d'authentification, erreurs annoncees et destination conservee. */
@Component({
  selector: 'app-authentification',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './authentification.html',
})
export class Authentification implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthentificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly mode = this.route.snapshot.data['mode'] as Mode;
  protected readonly titre = {
    connexion: 'Connexion',
    inscription: 'Créer un compte',
    oubli: 'Mot de passe oublié',
    changement: 'Choisir un nouveau mot de passe',
  }[this.mode];
  protected readonly champs: Champ[] =
    this.mode === 'inscription'
      ? [
          ADRESSE,
          { nom: 'prenom', label: 'Prénom', type: 'text', autocomplete: 'given-name', max: 120 },
          { nom: 'nom', label: 'Nom', type: 'text', autocomplete: 'family-name', max: 120 },
          {
            nom: 'nom_utilisateur',
            label: 'Nom d’utilisateur',
            type: 'text',
            autocomplete: 'username',
            max: 100,
          },
          MOT,
        ]
      : this.mode === 'changement'
        ? [MOT]
        : this.mode === 'oubli'
          ? [ADRESSE]
          : [ADRESSE, { ...MOT, autocomplete: 'current-password' }];
  protected readonly formulaire = new FormGroup(
    Object.fromEntries(
      this.champs.map((champ) => [
        champ.nom,
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.required,
            Validators.maxLength(champ.max),
            ...(champ.type === 'email' ? [Validators.email] : []),
          ],
        }),
      ]),
    ),
  );
  protected readonly envoi = signal(false);
  protected readonly erreur = signal('');
  protected readonly message = signal('');

  /** Retrouve une session temporaire apres fermeture puis reouverture d'un onglet. */
  async ngOnInit(): Promise<void> {
    try {
      await this.auth.charger();
      const retour = retourInterne(this.route.snapshot.queryParamMap.get('retour'));
      if (this.auth.restreinte() && this.mode !== 'changement') {
        await this.router.navigate(['/nouveau-mot-de-passe'], { queryParams: { retour } });
      } else if (this.auth.utilisateur() && ['connexion', 'changement'].includes(this.mode)) {
        await this.router.navigateByUrl(retour);
      }
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur));
    }
  }

  /** Libere aussi le cookie pour permettre une nouvelle demande apres abandon. */
  protected async annuler(): Promise<void> {
    if (this.envoi()) return;
    this.envoi.set(true);
    try {
      await this.auth.deconnecter();
      await this.router.navigateByUrl('/mot-de-passe-oublie');
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur));
    } finally {
      this.envoi.set(false);
    }
  }

  /** Le serveur verifie aussi la complexite des mots de passe choisis. */
  protected async envoyer(): Promise<void> {
    this.formulaire.markAllAsTouched();
    this.erreur.set('');
    this.message.set('');
    if (this.formulaire.invalid) {
      this.erreur.set('Vérifiez les champs indiqués.');
      return;
    }
    if (this.envoi()) return;
    this.envoi.set(true);
    try {
      const donnees = this.formulaire.getRawValue();
      const retour = retourInterne(this.route.snapshot.queryParamMap.get('retour'));
      if (this.mode === 'connexion') {
        await this.auth.connecter(donnees);
        await this.router.navigateByUrl(
          this.auth.restreinte()
            ? this.router.createUrlTree(['/nouveau-mot-de-passe'], { queryParams: { retour } })
            : retour,
        );
      } else if (this.mode === 'changement') {
        await this.api.modifier('PATCH', '/mot-de-passe', donnees);
        await this.auth.charger();
        await this.router.navigateByUrl(retour);
      } else {
        const resultat = await this.api.modifier<{ message: string }>(
          'POST',
          this.mode === 'oubli' ? '/mots-de-passe-oublies' : '/inscriptions',
          donnees,
        );
        this.message.set(resultat.message);
        this.formulaire.reset();
      }
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur));
    } finally {
      this.envoi.set(false);
    }
  }
}
