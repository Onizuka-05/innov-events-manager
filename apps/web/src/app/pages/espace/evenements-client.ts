import { Component, Injector, afterNextRender, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, messageErreur } from '../../core/api.service';
import { BadgeStatut } from '../../core/badge-statut';
import type { EvenementClient } from '../../core/espace-client.models';

/** Evenements du client : avis unique et accord de publication independant de la prestation. */
@Component({
  selector: 'app-evenements-client',
  imports: [DatePipe, FormsModule, BadgeStatut],
  styleUrl: './espace-client.css',
  templateUrl: './evenements-client.html',
})
export class EvenementsClient {
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  protected readonly evenements = signal<EvenementClient[]>([]);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  protected readonly envoisAvis = signal<string[]>([]);
  protected readonly envoisAccord = signal<string[]>([]);
  protected readonly erreurs = signal<Record<string, string>>({});
  protected readonly messages = signal<Record<string, string>>({});
  protected readonly notes = [1, 2, 3, 4, 5];
  protected saisies: Record<string, { note_evaluation: number | null; commentaire: string }> = {};
  constructor() {
    void this.charger();
  }
  /** Lit tous les evenements et prepare seulement les formulaires qui peuvent recevoir un avis. */
  protected async charger(): Promise<void> {
    if (this.chargement()) return;
    this.chargement.set(true);
    this.erreur.set('');
    try {
      const es = await this.api.get<EvenementClient[]>('/mes-evenements');
      for (const e of es)
        this.saisies[e.id_evenement] ??= { note_evaluation: null, commentaire: '' };
      this.evenements.set(es);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }
  /** Envoi unique d'un avis ; le serveur verifie aussi la propriete, le statut et l'unicite. */
  protected async envoyerAvis(e: EvenementClient): Promise<void> {
    const id = e.id_evenement;
    const cle = 'avis-' + id;
    if (this.envoisAvis().includes(id) || e.avis || e.statut_evenement !== 'termine') return;
    const d = this.saisies[id];
    const commentaire = d.commentaire.trim();
    this.erreurs.update((v) => ({ ...v, [cle]: '' }));
    if (
      !Number.isInteger(d.note_evaluation) ||
      !d.note_evaluation ||
      d.note_evaluation < 1 ||
      d.note_evaluation > 5 ||
      !commentaire ||
      commentaire.length > 2000
    ) {
      this.erreurs.update((v) => ({
        ...v,
        [cle]: 'Choisissez une note de 1 à 5 et un commentaire de 1 à 2 000 caractères.',
      }));
      return;
    }
    this.envoisAvis.update((v) => [...v, id]);
    try {
      const r = await this.api.modifier<{ statut_avis: string }>(
        'POST',
        `/mes-evenements/${id}/avis`,
        { note_evaluation: d.note_evaluation, commentaire },
      );
      this.evenements.update((es) =>
        es.map((x) =>
          x.id_evenement === id
            ? {
                ...x,
                avis: {
                  note_evaluation: d.note_evaluation!,
                  commentaire,
                  statut_avis: r.statut_avis,
                },
              }
            : x,
        ),
      );
      this.messages.update((v) => ({
        ...v,
        [cle]: 'Votre avis a été envoyé. Il est en attente de modération.',
      }));
      afterNextRender(() => document.getElementById('avis-' + id)?.focus(), {
        injector: this.injector,
      });
    } catch (erreur) {
      this.erreurs.update((v) => ({ ...v, [cle]: messageErreur(erreur) }));
    } finally {
      this.envoisAvis.update((v) => v.filter((x) => x !== id));
    }
  }
  /** Donne ou retire l'accord ; une erreur retablit la valeur effectivement enregistree. */
  protected async changerAccord(e: EvenementClient, evenement: Event): Promise<void> {
    const champ = evenement.target as HTMLInputElement;
    const accord = champ.checked;
    const id = e.id_evenement;
    const cle = 'accord-' + id;
    if (this.envoisAccord().includes(id)) {
      champ.checked = !!e.date_accord_publication;
      return;
    }
    this.envoisAccord.update((v) => [...v, id]);
    this.erreurs.update((v) => ({ ...v, [cle]: '' }));
    this.messages.update((v) => ({ ...v, [cle]: '' }));
    try {
      const r = await this.api.modifier<{ date_accord_publication: string | null }>(
        accord ? 'POST' : 'DELETE',
        `/mes-evenements/${id}/accord-publication`,
      );
      this.evenements.update((es) =>
        es.map((x) =>
          x.id_evenement === id ? { ...x, date_accord_publication: r.date_accord_publication } : x,
        ),
      );
      this.messages.update((v) => ({
        ...v,
        [cle]: accord
          ? 'Accord de publication enregistré.'
          : 'Accord retiré : cet événement ne figure plus au catalogue public.',
      }));
    } catch (erreur) {
      champ.checked = !!e.date_accord_publication;
      this.erreurs.update((v) => ({ ...v, [cle]: messageErreur(erreur) }));
    } finally {
      this.envoisAccord.update((v) => v.filter((x) => x !== id));
    }
  }
}
