import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
interface Prospect {
  id_prospect: string;
  entreprise: string;
  nom: string;
  prenom: string;
  email: string;
  date_souhaitee: string;
  statut_prospect: string;
}
/** Demandes recues sur le tableau de bord, avec lien vers la conversion et les devis. */
@Component({
  selector: 'app-prospects',
  imports: [FormsModule, RouterLink],
  templateUrl: './prospects.html',
  styleUrl: '../devis/devis.css',
})
export class Prospects {
  private readonly api = inject(ApiService);
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
      this.prospects.set(await this.api.get('/prospects'));
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
  protected libelleStatut(s: string) {
    return (
      (
        { a_contacter: 'À contacter', echoue: 'Échoué', converti: 'Converti' } as Record<
          string,
          string
        >
      )[s] ?? s
    );
  }
  protected classeStatut(s: string) {
    return s === 'converti' ? 'statut-succes' : s === 'echoue' ? 'statut-echec' : 'statut-attente';
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
}
