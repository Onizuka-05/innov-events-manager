import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';

/** Formulaire de devis conforme au parcours public, sans creation de compte. */
@Component({
  selector: 'app-demande-devis',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './demande-devis.html',
  styleUrl: './demande-devis.css',
})
export class DemandeDevis implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    entreprise: ['', [Validators.required, Validators.maxLength(255)]],
    nom: ['', [Validators.required, Validators.maxLength(120)]],
    prenom: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    telephone: ['', [Validators.required, Validators.maxLength(35)]],
    lieu_souhaite: ['', [Validators.required, Validators.maxLength(2000)]],
    date_souhaitee: ['', Validators.required],
    id_type_evenement: ['', Validators.required],
    nb_participants: [
      1,
      [
        Validators.required,
        Validators.min(1),
        Validators.max(2147483647),
        Validators.pattern(/^[0-9]+$/),
      ],
    ],
    description_besoin: ['', [Validators.required, Validators.maxLength(5000)]],
  });
  protected readonly types = signal<{ id_type_evenement: number; libelle: string }[]>([]);
  protected readonly chargement = signal(true);
  protected readonly envoi = signal(false);
  protected readonly erreur = signal('');
  protected readonly message = signal('');
  protected readonly notification = signal(true);

  /** Le formulaire attend les types d'evenement de reference. */
  async ngOnInit(): Promise<void> {
    await this.chargerTypes();
  }
  protected async chargerTypes(): Promise<void> {
    this.chargement.set(true);
    try {
      this.types.set(await this.api.get('/types-evenement'));
      this.erreur.set('');
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur));
    } finally {
      this.chargement.set(false);
    }
  }

  /** Affiche la confirmation retournee apres l'enregistrement, jamais avant. */
  protected async envoyer(): Promise<void> {
    this.formulaire.markAllAsTouched();
    this.erreur.set('');
    if (this.formulaire.invalid) {
      this.erreur.set('Vérifiez tous les champs obligatoires.');
      return;
    }
    if (this.envoi() || this.chargement() || !this.types().length) return;
    this.envoi.set(true);
    try {
      const d = this.formulaire.getRawValue();
      const resultat = await this.api.modifier<{
        texte_remerciement: string;
        notification_envoyee: boolean;
      }>('POST', '/prospects', {
        ...d,
        id_type_evenement: Number(d.id_type_evenement),
        nb_participants: Number(d.nb_participants),
      });
      this.message.set(resultat.texte_remerciement);
      this.notification.set(resultat.notification_envoyee);
      this.formulaire.reset();
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur));
    } finally {
      this.envoi.set(false);
    }
  }
}
