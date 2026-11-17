import { Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, messageErreur } from '../../core/api.service';
import type { Prospect } from '../../core/prospects.models';
import { AuthentificationService } from '../../core/authentification.service';
import { BadgeStatut } from '../../core/badge-statut';

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
interface Client {
  id_client: string;
  entreprise: string;
  nom_contact: string;
  email_contact: string | null;
  adresse_postale: string | null;
}
interface Evenement {
  id_evenement: string;
  id_client: string;
  nom: string;
  statut_evenement: string;
}

const FORMAT_EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** Vue admin et vue client, protections reelles imposees par l'API. */
@Component({
  selector: 'app-devis',
  imports: [FormsModule, RouterLink, BadgeStatut],
  templateUrl: './devis.html',
  styleUrl: './devis.css',
})
export class Devis {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  protected filtre_devis = '';
  private prospectPrepare = '';
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
  protected readonly clients = signal<Client[]>([]);
  protected readonly evenements = signal<Evenement[]>([]);
  protected motif = '';
  protected choix = 'modification';
  protected nouvelIntitule = '';
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
        const id = this.route.snapshot.queryParamMap.get('prospect');
        if (id && id !== this.prospectPrepare) {
          const p = prospects.find(
            (p) => p.id_prospect === id && p.statut_prospect === 'converti' && p.id_client,
          );
          if (!p) {
            this.erreur.set(
              'La demande convertie est introuvable. Choisissez une demande ou un client.',
            );
            return;
          }
          this.prospectPrepare = id;
          this.id_prospect_evenement = id;
          this.preRemplirEvenement();
          this.focaliser('titre-evenement');
        }
      }
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
  protected devisFiltres() {
    return this.devis().filter((d) => !this.filtre_devis || d.statut_devis === this.filtre_devis);
  }
  protected evenementAccepte(id: string) {
    return this.evenements().some((e) => e.id_evenement === id && e.statut_evenement === 'accepte');
  }
  protected demarrer(id: string) {
    return this.operation(async () => {
      const e = await this.api.get<{
        nom: string;
        id_type_evenement: number;
        id_theme: number | null;
        date_debut: string;
        date_fin: string;
        lieu: string;
        image_url: string | null;
        visible_public: boolean;
      }>('/evenements/' + id);
      await this.api.modifier('PATCH', '/evenements/' + id, {
        nom: e.nom,
        id_type_evenement: e.id_type_evenement,
        id_theme: e.id_theme,
        date_debut: e.date_debut,
        date_fin: e.date_fin,
        lieu: e.lieu,
        image_url: e.image_url,
        visible_public: e.visible_public,
        statut_evenement: 'en_cours',
      });
    }, 'Événement passé en cours.');
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
      'Événement créé : il est présélectionné à l’étape 2.',
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
