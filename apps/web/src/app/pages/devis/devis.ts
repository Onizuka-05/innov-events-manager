import { Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import { AuthentificationService } from '../../core/authentification.service';

interface Ligne {
  libelle_prestation: string;
  montant_ht: number;
}
interface DevisItem {
  id_devis: string;
  id_evenement: string;
  intitule: string;
  statut_devis: string;
  evenement: string;
  entreprise: string;
}
interface Detail extends DevisItem {
  taux_tva_applique: string;
  motif_modification: string | null;
  lignes: (Ligne & { id_ligne_devis: string })[];
  totaux: { total_ht: string; total_tva: string; total_ttc: string };
}
interface Prospect {
  id_prospect: string;
  entreprise: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  statut_prospect: string;
  id_client: string | null;
  id_type_evenement: number;
  lieu_souhaite: string;
  date_souhaitee: string;
}
interface Client {
  id_client: string;
  entreprise: string;
  nom_contact: string;
}
interface Evenement {
  id_evenement: string;
  id_client: string;
  nom: string;
  statut_evenement: string;
}

/** Libelles lisibles des statuts (prospects et devis). */
const LIBELLES_STATUT: Record<string, string> = {
  a_contacter: 'À contacter',
  converti: 'Converti',
  echoue: 'Échoué',
  en_preparation: 'En préparation',
  etude_client: 'Étude client',
  modification: 'Modification demandée',
  accepte: 'Accepté',
  refuse: 'Refusé',
};
/** Couleur du badge : attente, succes, echec ou neutre. */
const CLASSES_STATUT: Record<string, string> = {
  a_contacter: 'statut-attente',
  etude_client: 'statut-info',
  modification: 'statut-attente',
  converti: 'statut-succes',
  accepte: 'statut-succes',
  echoue: 'statut-echec',
  refuse: 'statut-echec',
};
const FORMAT_EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** Vue admin et vue client, protections reelles imposees par l'API. */
@Component({
  selector: 'app-devis',
  imports: [FormsModule, RouterLink],
  templateUrl: './devis.html',
  styleUrl: './devis.css',
})
export class Devis {
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  protected readonly auth = inject(AuthentificationService);
  protected readonly admin = computed(() => this.auth.utilisateur()?.role === 'admin');
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  protected readonly information = signal('');
  protected readonly devis = signal<DevisItem[]>([]);
  protected readonly selection = signal<Detail | null>(null);
  protected readonly prospects = signal<Prospect[]>([]);
  protected readonly types = signal<{ id_type_evenement: number; libelle: string }[]>([]);
  protected readonly themes = signal<{ id_theme: number; libelle: string }[]>([]);
  protected recherche = '';
  protected filtreStatut = '';
  protected messageEchec = '';
  protected readonly prospectEchec = signal<Prospect | null>(null);
  protected readonly clients = signal<Client[]>([]);
  protected readonly evenements = signal<Evenement[]>([]);
  protected motif = '';
  protected choix = 'modification';
  protected nouvelIntitule = '';
  protected adresse_postale = '';
  protected id_prospect = '';
  protected id_client = '';
  protected id_prospect_evenement = '';
  protected visible_public = false;
  protected id_type_evenement = 1;
  protected id_theme: number | null = null;
  protected nom = '';
  protected date_debut = '';
  protected date_fin = '';
  protected lieu = '';
  protected statut_evenement = 'brouillon';
  protected image_url = '';
  protected id_evenement = '';
  protected intitule = '';
  protected lignes: Ligne[] = [];
  constructor() {
    void this.charger();
  }
  /** Methode et non computed : id_prospect est un champ ngModel, pas un signal. */
  protected prospectConversion(): Prospect | null {
    return this.prospects().find((p) => p.id_prospect === this.id_prospect) ?? null;
  }
  protected libelleStatut(statut: string): string {
    return LIBELLES_STATUT[statut] ?? statut;
  }
  protected classeStatut(statut: string): string {
    return CLASSES_STATUT[statut] ?? 'statut-neutre';
  }
  protected euros(montant: string | number): string {
    return FORMAT_EUROS.format(Number(montant));
  }
  protected pourcentage(taux: string): string {
    return `${Number(taux).toLocaleString('fr-FR')} %`;
  }
  protected dateCourte(date: string): string {
    const [annee, mois, jour] = date.slice(0, 10).split('-');
    return jour && mois && annee ? `${jour}/${mois}/${annee}` : date;
  }
  protected nomEvenement(idDevis: string): string {
    return this.devis().find((d) => d.id_devis === idDevis)?.evenement ?? '';
  }
  protected async charger() {
    try {
      this.devis.set(await this.api.get<DevisItem[]>('/devis'));
      if (this.admin()) {
        const [prospects, clients, evenements, types, themes] = await Promise.all([
          this.api.get<Prospect[]>('/prospects'),
          this.api.get<Client[]>('/clients'),
          this.api.get<Evenement[]>('/evenements'),
          this.api.get<{ id_type_evenement: number; libelle: string }[]>('/types-evenement'),
          this.api.get<{ id_theme: number; libelle: string }[]>('/themes'),
        ]);
        this.prospects.set(prospects);
        this.clients.set(clients);
        this.evenements.set(evenements);
        this.types.set(types);
        this.themes.set(themes);
      }
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected async ouvrir(id: string) {
    try {
      const d = await this.api.get<Detail>(`/devis/${encodeURIComponent(id)}`);
      this.selection.set(d);
      this.nouvelIntitule = d.intitule;
      this.lignes = d.lignes.map((l) => ({
        libelle_prestation: l.libelle_prestation,
        montant_ht: Number(l.montant_ht),
      }));
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected async afficher(id: string) {
    await this.ouvrir(id);
    this.focaliser('detail-devis');
  }
  /** Deplace le focus (et le defilement) vers l'etape suivante une fois l'ecran mis a jour. */
  private focaliser(id: string) {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }
  private async operation(
    fn: () => Promise<unknown>,
    message = 'Opération enregistrée.',
    apres?: () => void | Promise<void>,
  ) {
    if (this.chargement()) return;
    this.chargement.set(true);
    this.erreur.set('');
    this.information.set('');
    try {
      await fn();
      this.information.set(message);
      await this.charger();
      await apres?.();
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
  protected prospectsFiltres() {
    return this.prospects().filter(
      (p) =>
        (!this.filtreStatut || p.statut_prospect === this.filtreStatut) &&
        `${p.entreprise} ${p.nom} ${p.prenom} ${p.email}`
          .toLocaleLowerCase()
          .includes(this.recherche.toLocaleLowerCase()),
    );
  }
  protected choisirEchec(p: Prospect) {
    this.prospectEchec.set(p);
    this.messageEchec = '';
  }
  protected annulerEchec() {
    this.prospectEchec.set(null);
    this.messageEchec = '';
  }
  protected echouer() {
    return this.operation(async () => {
      const p = this.prospectEchec();
      if (!p) return;
      await this.api.modifier('POST', `/prospects/${p.id_prospect}/echec`, {
        message: this.messageEchec,
      });
      this.annulerEchec();
    }, 'Demande classée sans suite : le message a été envoyé par e-mail.');
  }
  protected choisirConversion(id: string) {
    this.id_prospect = id;
    this.adresse_postale = '';
    document.getElementById('adresse')?.focus();
  }
  protected convertir() {
    const id = this.id_prospect;
    return this.operation(
      async () => {
        await this.api.modifier('POST', `/prospects/${id}/conversion`, {
          adresse_postale: this.adresse_postale,
        });
        this.id_prospect = '';
        this.adresse_postale = '';
      },
      'Client créé : l’événement est pré-rempli à l’étape 2.',
      () => {
        this.id_prospect_evenement = id;
        this.preRemplirEvenement();
        this.focaliser('titre-evenement');
      },
    );
  }
  protected preRemplirEvenement() {
    const p = this.prospects().find((p) => p.id_prospect === this.id_prospect_evenement);
    if (!p) return;
    if (p.id_client) this.id_client = p.id_client;
    this.nom = `Événement ${p.entreprise}`;
    this.id_type_evenement = p.id_type_evenement;
    this.lieu = p.lieu_souhaite;
    const date = p.date_souhaitee.slice(0, 10);
    this.date_debut = `${date}T09:00`;
    this.date_fin = `${date}T17:00`;
  }
  protected creerEvenement() {
    let idEvenement = '';
    return this.operation(
      async () => {
        const cree = await this.api.modifier<{ id_evenement: string }>('POST', '/evenements', {
          id_client: this.id_client,
          id_prospect: this.id_prospect_evenement || null,
          id_type_evenement: Number(this.id_type_evenement),
          id_theme: this.id_theme,
          nom: this.nom,
          date_debut: new Date(this.date_debut).toISOString(),
          date_fin: new Date(this.date_fin).toISOString(),
          lieu: this.lieu,
          statut_evenement: this.statut_evenement,
          image_url: this.image_url || null,
          visible_public: this.visible_public,
        });
        idEvenement = cree.id_evenement;
        this.viderEvenement();
      },
      'Événement créé : il est présélectionné à l’étape 3.',
      () => {
        this.id_evenement = idEvenement;
        this.focaliser('titre-creation-devis');
      },
    );
  }
  private viderEvenement() {
    this.id_client = '';
    this.id_prospect_evenement = '';
    this.nom = '';
    this.id_theme = null;
    this.date_debut = '';
    this.date_fin = '';
    this.lieu = '';
    this.statut_evenement = 'brouillon';
    this.image_url = '';
    this.visible_public = false;
  }
  protected creerDevis() {
    let idDevis = '';
    return this.operation(
      async () => {
        const cree = await this.api.modifier<{ id_devis: string }>('POST', '/devis', {
          id_evenement: this.id_evenement,
          intitule: this.intitule,
        });
        idDevis = cree.id_devis;
        this.intitule = '';
      },
      'Devis créé : ajoutez ses prestations ci-dessous.',
      () => this.afficher(idDevis),
    );
  }
  protected modifierIntitule() {
    return this.operation(async () => {
      const id = this.selection()?.id_devis;
      if (!id) return;
      await this.api.modifier('PATCH', `/devis/${id}`, { intitule: this.nouvelIntitule });
      await this.ouvrir(id);
    }, 'Intitulé modifié.');
  }
  protected enregistrerLignes() {
    return this.operation(async () => {
      const id = this.selection()?.id_devis;
      if (!id) return;
      await this.api.modifier('POST', `/devis/${id}/lignes`, { lignes: this.lignes });
      await this.ouvrir(id);
    }, 'Prestations enregistrées.');
  }
  protected ajouterLigne() {
    this.lignes = [...this.lignes, { libelle_prestation: '', montant_ht: 0 }];
  }
  protected retirerLigne(index: number) {
    this.lignes = this.lignes.filter((_, i) => i !== index);
  }
  protected envoyer() {
    return this.operation(async () => {
      const id = this.selection()?.id_devis;
      if (!id) return;
      await this.api.modifier('POST', `/devis/${id}/envoi`);
      await this.ouvrir(id);
    }, 'Devis envoyé au client.');
  }
  protected telecharger() {
    const id = this.selection()?.id_devis;
    if (id) window.location.href = `/api/devis/${encodeURIComponent(id)}/pdf`;
  }
  protected repondre() {
    return this.operation(async () => {
      const id = this.selection()?.id_devis;
      if (!id) return;
      await this.api.modifier('POST', `/devis/${id}/reponse`, {
        choix: this.choix,
        motif_modification: this.motif,
      });
      await this.ouvrir(id);
    }, 'Réponse enregistrée.');
  }
}
