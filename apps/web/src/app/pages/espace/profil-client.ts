import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';
import type { ProfilClient } from '../../core/espace-client.models';

const champ = (max: number, courriel = false) =>
  new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(max),
      ...(courriel ? [Validators.email] : []),
    ],
  });
/** Profil et effacement confirme du compte ; une erreur conserve toujours la session courante. */
@Component({
  selector: 'app-profil-client',
  imports: [ReactiveFormsModule],
  styleUrl: './espace-client.css',
  templateUrl: './profil-client.html',
})
export class ProfilClientPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthentificationService);
  private readonly router = inject(Router);
  protected readonly profil = signal<ProfilClient | null>(null);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  protected readonly envoi = signal('');
  protected readonly erreurs = signal<Record<string, string>>({});
  protected readonly messages = signal<Record<string, string>>({});
  protected readonly compte = new FormGroup({
    prenom: champ(120),
    nom: champ(120),
    nom_utilisateur: champ(100),
    email_connexion: champ(255, true),
  });
  protected readonly fiche = new FormGroup({
    entreprise: champ(255),
    prenom_contact: champ(120),
    nom_contact: champ(120),
    email_contact: champ(255, true),
    telephone: champ(35),
    adresse_postale: champ(2000),
  });
  protected readonly motActuel = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(256)],
  });
  protected readonly suppression = new FormGroup({
    mot_de_passe: champ(256),
    confirmation: new FormControl(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });
  protected readonly champsCompte = [
    { cle: 'prenom', libelle: 'Prénom', max: 120, type: 'text', auto: 'given-name' },
    { cle: 'nom', libelle: 'Nom', max: 120, type: 'text', auto: 'family-name' },
    {
      cle: 'nom_utilisateur',
      libelle: 'Nom d’utilisateur',
      max: 100,
      type: 'text',
      auto: 'username',
    },
    {
      cle: 'email_connexion',
      libelle: 'E-mail de connexion',
      max: 255,
      type: 'email',
      auto: 'email',
    },
  ] as const;
  protected readonly champsFiche = [
    { cle: 'entreprise', libelle: 'Entreprise', max: 255, type: 'text', auto: 'organization' },
    {
      cle: 'prenom_contact',
      libelle: 'Prénom du contact',
      max: 120,
      type: 'text',
      auto: 'given-name',
    },
    { cle: 'nom_contact', libelle: 'Nom du contact', max: 120, type: 'text', auto: 'family-name' },
    { cle: 'email_contact', libelle: 'E-mail du contact', max: 255, type: 'email', auto: 'email' },
    { cle: 'telephone', libelle: 'Téléphone', max: 35, type: 'tel', auto: 'tel' },
    {
      cle: 'adresse_postale',
      libelle: 'Adresse postale',
      max: 2000,
      type: 'text',
      auto: 'street-address',
    },
  ] as const;
  constructor() {
    this.compte.controls.email_connexion.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.erreurs.update((erreurs) => ({ ...erreurs, compte: '' }));
    });
    void this.charger();
  }
  /** Charge separement l'identite du compte et les coordonnees commerciales. */
  protected async charger(): Promise<void> {
    if (this.chargement()) return;
    this.chargement.set(true);
    this.erreur.set('');
    try {
      const p = await this.api.get<ProfilClient>('/profil');
      this.profil.set(p);
      this.compte.reset(p.compte);
      if (p.fiche) this.fiche.reset({ ...p.fiche, adresse_postale: p.fiche.adresse_postale ?? '' });
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
  /** La verification du mot de passe ne concerne que le changement effectif d'e-mail. */
  protected emailModifie(): boolean {
    return (
      this.compte.controls.email_connexion.value.trim().toLowerCase() !==
      this.profil()?.compte.email_connexion.toLowerCase()
    );
  }
  protected async enregistrerCompte(): Promise<void> {
    const d = this.compte.getRawValue();
    this.compte.markAllAsTouched();
    if (this.compte.invalid || Object.values(d).some((v) => !v.trim())) {
      this.erreurs.update((v) => ({ ...v, compte: 'Vérifiez les champs du compte.' }));
      return;
    }
    if (this.emailModifie() && (!this.motActuel.value || this.motActuel.invalid)) {
      this.erreurs.update((v) => ({
        ...v,
        compte: 'Saisissez votre mot de passe actuel pour changer l’e-mail de connexion.',
      }));
      return;
    }
    await this.operation(
      'compte',
      async () => {
        const p = await this.api.modifier<ProfilClient>('PATCH', '/profil', {
          compte: {
            prenom: d.prenom.trim(),
            nom: d.nom.trim(),
            nom_utilisateur: d.nom_utilisateur.trim(),
            email_connexion: d.email_connexion.trim(),
          },
          ...(this.emailModifie() ? { mot_de_passe_actuel: this.motActuel.value } : {}),
        });
        this.profil.set(p);
        this.compte.reset(p.compte);
        this.motActuel.reset();
        this.auth.utilisateur.update((u) => (u ? { ...u, ...p.compte } : u));
      },
      'Votre compte a été mis à jour.',
    );
  }
  protected async enregistrerFiche(): Promise<void> {
    const d = this.fiche.getRawValue();
    this.fiche.markAllAsTouched();
    if (this.fiche.invalid || Object.values(d).some((v) => !v.trim())) {
      this.erreurs.update((v) => ({ ...v, fiche: 'Vérifiez les coordonnées du contact.' }));
      return;
    }
    await this.operation(
      'fiche',
      async () => {
        const p = await this.api.modifier<ProfilClient>('PATCH', '/profil', {
          fiche: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim()])),
        });
        this.profil.set(p);
        if (p.fiche)
          this.fiche.reset({ ...p.fiche, adresse_postale: p.fiche.adresse_postale ?? '' });
      },
      'Vos coordonnées ont été mises à jour.',
    );
  }
  /** Efface l'etat local uniquement apres confirmation de la suppression par le serveur. */
  protected async supprimerCompte(): Promise<void> {
    this.suppression.markAllAsTouched();
    if (this.suppression.invalid) {
      this.erreurs.update((v) => ({
        ...v,
        suppression: 'Saisissez votre mot de passe et cochez la confirmation.',
      }));
      return;
    }
    await this.operation(
      'suppression',
      async () => {
        await this.api.modifier('DELETE', '/profil', {
          mot_de_passe: this.suppression.controls.mot_de_passe.value,
        });
        this.auth.utilisateur.set(null);
        this.auth.restreinte.set(false);
        this.suppression.reset();
        this.motActuel.reset();
        await this.router.navigate(['/'], { queryParams: { compte_supprime: '1' } });
      },
      '',
    );
  }
  private async operation(
    cle: string,
    action: () => Promise<void>,
    message: string,
  ): Promise<void> {
    if (this.envoi()) return;
    this.envoi.set(cle);
    this.erreurs.update((v) => ({ ...v, [cle]: '' }));
    this.messages.update((v) => ({ ...v, [cle]: '' }));
    try {
      await action();
      this.messages.update((v) => ({ ...v, [cle]: message }));
    } catch (e) {
      this.erreurs.update((v) => ({ ...v, [cle]: messageErreur(e) }));
    } finally {
      this.envoi.set('');
    }
  }
}
