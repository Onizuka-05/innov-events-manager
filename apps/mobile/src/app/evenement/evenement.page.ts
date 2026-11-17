import { DatePipe } from '@angular/common';
import { Component, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular';

import { ApiService, messageErreur } from '../core/api.service';
import type { FicheEvenement } from '../core/gestion.types';
import { familleStatut, libelleStatut } from '../core/statuts';

/** Fiche d'un evenement (MOB-02) et ajout rapide d'une note partagee (MOB-04). */
@Component({
  selector: 'app-evenement',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent],
  templateUrl: './evenement.page.html',
})
export class EvenementPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly zoneNote = viewChild<ElementRef<HTMLTextAreaElement>>('zoneNote');
  private readonly boutonAjout = viewChild<ElementRef<HTMLButtonElement>>('boutonAjout');
  protected readonly fiche = signal<FicheEvenement | null>(null);
  protected readonly erreur = signal('');
  protected readonly chargement = signal(false);
  protected readonly saisie = signal(false);
  protected readonly envoi = signal(false);
  protected readonly erreurNote = signal('');
  protected readonly confirmation = signal('');
  protected readonly note = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(5000)],
  });
  protected readonly formulaire = new FormGroup({ contenu: this.note });
  protected readonly famille = familleStatut;
  protected readonly libelle = libelleStatut;

  /** Identifiant lu dans l'adresse ; une valeur non numerique n'est jamais envoyee a l'API. */
  private get id(): string | null {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    return /^[1-9][0-9]{0,17}$/u.test(id) ? id : null;
  }

  async ionViewWillEnter(): Promise<void> {
    await this.charger();
  }

  protected async charger(): Promise<void> {
    if (this.chargement()) return;
    if (!this.id) {
      this.erreur.set('Événement introuvable.');
      return;
    }
    this.chargement.set(true);
    this.erreur.set('');
    try {
      this.fiche.set(await this.api.get<FicheEvenement>(`/evenements/${this.id}`));
    } catch (e) {
      this.fiche.set(null);
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }

  /** Ouvre la saisie et place le curseur dans la zone de texte. */
  protected ouvrirSaisie(): void {
    this.confirmation.set('');
    this.erreurNote.set('');
    this.saisie.set(true);
    setTimeout(() => this.zoneNote()?.nativeElement.focus());
  }

  /** Ferme la saisie sans envoyer et rend le focus au bouton d'ajout. */
  protected annuler(): void {
    if (this.envoi()) return;
    this.saisie.set(false);
    this.note.reset();
    this.erreurNote.set('');
    setTimeout(() => this.boutonAjout()?.nativeElement.focus());
  }

  /** Envoie la note une seule fois, puis recharge la fiche pour l'afficher. */
  protected async enregistrer(): Promise<void> {
    if (this.envoi()) return;
    const contenu = this.note.value.trim();
    if (!contenu || this.note.invalid) {
      this.note.markAsTouched();
      this.erreurNote.set('Saisissez le texte de la note (5 000 caractères au plus).');
      return;
    }
    const fiche = this.fiche();
    if (!fiche) return;
    this.envoi.set(true);
    this.erreurNote.set('');
    try {
      await this.api.modifier('POST', '/notes', { id_evenement: fiche.id_evenement, contenu });
      this.note.reset();
      this.saisie.set(false);
      await this.charger();
      this.confirmation.set('Note enregistrée et partagée avec l’équipe.');
      setTimeout(() => this.boutonAjout()?.nativeElement.focus());
    } catch (e) {
      this.erreurNote.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
