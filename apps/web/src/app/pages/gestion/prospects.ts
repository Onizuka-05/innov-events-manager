import { Component, Injector, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  }
  protected choisirConversion(id: string) {
    this.preparerConversion(id);
    afterNextRender(() => document.getElementById('adresse')?.focus(), { injector: this.injector });
  }
  protected async convertir() {
    if (this.chargement() || !this.id_prospect || !this.adresse_postale.trim()) return;
    const id = this.id_prospect;
    this.chargement.set(true);
    this.erreur.set('');
    this.information.set('');
    try {
      await this.api.modifier('POST', '/prospects/' + id + '/conversion', {
        adresse_postale: this.adresse_postale,
      });
      await this.router.navigate(['/administration/devis'], { queryParams: { prospect: id } });
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
}
