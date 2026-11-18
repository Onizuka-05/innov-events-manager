import { Component, Injector, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService, messageErreur } from '../../core/api.service';
import type { Prospect } from '../../core/prospects.models';
import type { Client } from '../../core/gestion.models';
import { BadgeStatut } from '../../core/badge-statut';

/** Recherche, classement et conversion des demandes recues. */
@Component({
  selector: 'app-prospects',
  imports: [FormsModule, BadgeStatut],
  templateUrl: './prospects.html',
  styleUrl: '../devis/devis.css',
})
export class Prospects {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly clients = signal<Client[]>([]);
  protected id_prospect = '';
  protected adresse_postale = '';
  /**
   * Confirmation du rattachement : la demande et la fiche affichees au moment ou la case est
   * cochee. Si la fiche affichee change ensuite (liste relue), la confirmation ne vaut plus.
   */
  private confirmation: { id_prospect: string; id_client: string } | null = null;
  protected readonly prospects = signal<Prospect[]>([]);
  protected readonly prospectEchec = signal<Prospect | null>(null);
  protected readonly erreur = signal('');
  protected readonly information = signal('');
  protected readonly chargement = signal(false);
  protected recherche = '';
  protected filtreStatut = '';
  protected messageEchec = '';
  constructor() {
    void this.charger();
  }
  private async charger() {
    try {
      const [prospects, clients] = await Promise.all([
        this.api.get<Prospect[]>('/prospects'),
        this.api.get<Client[]>('/clients'),
      ]);
      this.prospects.set(prospects);
      this.clients.set(clients);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected prospectsFiltres() {
    return this.prospects().filter(
      (p) =>
        (!this.filtreStatut || p.statut_prospect === this.filtreStatut) &&
        [p.entreprise, p.nom, p.prenom, p.email]
          .join(' ')
          .toLocaleLowerCase()
          .includes(this.recherche.toLocaleLowerCase()),
    );
  }
  protected dateCourte(v: string) {
    return v.slice(0, 10).split('-').reverse().join('/');
  }
  protected choisirEchec(p: Prospect) {
    this.prospectEchec.set(p);
    this.messageEchec = '';
  }
  protected annulerEchec() {
    this.prospectEchec.set(null);
    this.messageEchec = '';
  }
  protected async echouer() {
    const p = this.prospectEchec();
    if (!p || this.chargement()) return;
    this.chargement.set(true);
    this.erreur.set('');
    this.information.set('');
    try {
      await this.api.modifier('POST', '/prospects/' + p.id_prospect + '/echec', {
        message: this.messageEchec,
      });
      this.annulerEchec();
      await this.charger();
      this.information.set('Demande classée sans suite et e-mail envoyé.');
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
  /** Retrouve les informations relues depuis l'API pour la conversion. */
  protected prospectConversion(): Prospect | null {
    return this.prospects().find((p) => p.id_prospect === this.id_prospect) ?? null;
  }
  protected clientExistant(p: Prospect): Client | null {
    return (
      this.clients().find(
        (c) => c.email_contact?.toLocaleLowerCase() === p.email.toLocaleLowerCase(),
      ) ?? null
    );
  }
  protected preparerConversion(id: string) {
    this.id_prospect = id;
    const p = this.prospectConversion();
    this.adresse_postale = (p && this.clientExistant(p)?.adresse_postale) || '';
    this.confirmation = null;
  }
  /** Fiche existante a confirmer pour la demande en cours de conversion, ou null. */
  private ficheAConfirmer(): Client | null {
    const p = this.prospectConversion();
    return p && this.clientExistant(p);
  }
  /** Vrai seulement si la case a ete cochee pour cette demande et cette fiche precises. */
  protected rattachementConfirme(): boolean {
    const c = this.ficheAConfirmer();
    return (
      !!c &&
      this.confirmation?.id_prospect === this.id_prospect &&
      this.confirmation.id_client === c.id_client
    );
  }
  protected confirmerRattachement(coche: boolean) {
    const c = this.ficheAConfirmer();
    this.confirmation =
      coche && c ? { id_prospect: this.id_prospect, id_client: c.id_client } : null;
  }
  /** Vrai si la conversion peut partir : adresse saisie et rattachement confirme s'il y a lieu. */
  protected conversionPrete(): boolean {
    const p = this.prospectConversion();
    return (
      !!p &&
      !!this.adresse_postale.trim() &&
      (!this.clientExistant(p) || this.rattachementConfirme())
    );
  }
  protected choisirConversion(id: string) {
    this.preparerConversion(id);
    afterNextRender(() => document.getElementById('adresse')?.focus(), { injector: this.injector });
  }
  protected async convertir() {
    if (this.chargement() || !this.conversionPrete()) return;
    const id = this.id_prospect;
    // Fiche confirmee par la case (meme fiche que celle affichee, verifie par conversionPrete).
    const confirmee = this.ficheAConfirmer() ? this.confirmation : null;
    this.chargement.set(true);
    this.erreur.set('');
    this.information.set('');
    try {
      await this.api.modifier('POST', '/prospects/' + id + '/conversion', {
        adresse_postale: this.adresse_postale,
        id_client_confirme: confirmee?.id_client ?? null,
      });
      await this.router.navigate(['/administration/devis'], { queryParams: { prospect: id } });
    } catch (e) {
      // Fiche apparue, modifiee ou effacee depuis l'affichage : la liste est relue avant de
      // demander une nouvelle confirmation.
      if (e instanceof HttpErrorResponse && e.error?.code === 'RATTACHEMENT_A_CONFIRMER') {
        await this.charger();
        this.preparerConversion(id);
      }
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
}
