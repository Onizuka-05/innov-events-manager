import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, messageErreur } from '../../core/api.service';
import { BadgeStatut } from '../../core/badge-statut';
import { ImageEvenement } from './image-evenement';
import type { PageEvenements, FiltresCatalogue } from './catalogue.models';

const PARAMETRES_CATALOGUE = ['du', 'au', 'type', 'theme', 'tri', 'page'];

/** Catalogue public : filtres et pagination dans l'URL, retour navigateur pris en compte. */
@Component({
  selector: 'app-catalogue',
  imports: [FormsModule, DatePipe, RouterLink, BadgeStatut, ImageEvenement],
  styleUrl: './catalogue.css',
  templateUrl: './catalogue.html',
})
export class Catalogue {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly page = signal<PageEvenements | null>(null);
  protected readonly filtres = signal<FiltresCatalogue>({ types: [], themes: [] });
  protected readonly erreur = signal('');
  protected readonly erreurFiltres = signal('');
  protected readonly chargement = signal(false);
  protected du = '';
  protected au = '';
  protected type = '';
  protected theme = '';
  protected tri = 'recent';
  private requete = 0;
  constructor() {
    void this.chargerFiltres();
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.du = params.get('du') ?? '';
      this.au = params.get('au') ?? '';
      this.type = params.get('type') ?? '';
      this.theme = params.get('theme') ?? '';
      this.tri = params.get('tri') || 'recent';
      const q = new URLSearchParams();
      for (const cle of PARAMETRES_CATALOGUE)
        for (const valeur of params.getAll(cle)) q.append(cle, valeur);
      void this.charger(q.toString());
    });
  }
  private async chargerFiltres(): Promise<void> {
    this.erreurFiltres.set('');
    try {
      this.filtres.set(await this.api.get<FiltresCatalogue>('/evenements-publics/filtres'));
    } catch (e) {
      this.erreurFiltres.set(messageErreur(e));
    }
  }
  private async charger(q: string): Promise<void> {
    const numero = ++this.requete;
    this.chargement.set(true);
    this.erreur.set('');
    this.page.set(null);
    try {
      const p = await this.api.get<PageEvenements>('/evenements-publics' + (q ? '?' + q : ''));
      if (numero === this.requete) this.page.set(p);
    } catch (e) {
      if (numero === this.requete) this.erreur.set(messageErreur(e));
    } finally {
      if (numero === this.requete) this.chargement.set(false);
    }
  }
  /** Retente la lecture courante, meme si l'URL n'a pas change. */
  protected reessayer(): void {
    const params = this.route.snapshot.queryParamMap;
    const q = new URLSearchParams();
    for (const cle of PARAMETRES_CATALOGUE)
      for (const valeur of params.getAll(cle)) q.append(cle, valeur);
    void this.charger(q.toString());
    if (this.erreurFiltres()) void this.chargerFiltres();
  }
  /** Une nouvelle recherche repart de la premiere page et ne garde que les filtres proposes. */
  protected rechercher(): Promise<boolean> {
    return this.router.navigate(['/evenements'], {
      queryParams: {
        du: this.du || null,
        au: this.au || null,
        type: this.type || null,
        theme: this.theme || null,
        tri: this.tri === 'recent' ? null : this.tri,
      },
    });
  }
  protected reinitialiser(): Promise<boolean> {
    this.du = '';
    this.au = '';
    this.type = '';
    this.theme = '';
    this.tri = 'recent';
    return this.router.navigate(['/evenements']);
  }
  /** La pagination preserve les filtres de la recherche courante. */
  protected parametres(page: number) {
    const filtres = Object.fromEntries(
      Object.entries(this.route.snapshot.queryParams).filter(([cle]) =>
        PARAMETRES_CATALOGUE.includes(cle),
      ),
    );
    return { ...filtres, page: page === 1 ? null : page };
  }
  protected nombrePages(): number {
    const p = this.page();
    return p ? Math.max(1, Math.ceil(p.total / p.par_page)) : 1;
  }
}
