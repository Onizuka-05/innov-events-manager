import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, messageErreur } from '../../core/api.service';
import { BadgeStatut } from '../../core/badge-statut';
import { ImageEvenement } from './image-evenement';
import type { EvenementPublic } from './catalogue.models';
/** Detail public et entree explicite vers une demande de prestations et devis. */
@Component({
  selector: 'app-detail-evenement',
  imports: [DatePipe, RouterLink, BadgeStatut, ImageEvenement],
  styleUrl: './catalogue.css',
  templateUrl: './detail-evenement.html',
})
export class DetailEvenement {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private requete = 0;
  protected readonly evenement = signal<EvenementPublic | null>(null);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((p) => void this.charger(p.get('id') ?? ''));
  }
  private async charger(id: string): Promise<void> {
    const numero = ++this.requete;
    this.evenement.set(null);
    this.erreur.set('');
    if (!/^[1-9][0-9]{0,17}$/u.test(id)) {
      this.erreur.set('Événement introuvable.');
      this.chargement.set(false);
      return;
    }
    this.chargement.set(true);
    try {
      const e = await this.api.get<EvenementPublic>('/evenements-publics/' + id);
      if (numero === this.requete) this.evenement.set(e);
    } catch (e) {
      if (numero === this.requete)
        this.erreur.set(
          e instanceof HttpErrorResponse && e.status === 404
            ? 'Événement introuvable ou non publié.'
            : messageErreur(e),
        );
    } finally {
      if (numero === this.requete) this.chargement.set(false);
    }
  }
}
