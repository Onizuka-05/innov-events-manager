import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { PAGES_LEGALES, type NomPageLegale } from './contenus-legaux';

/** Rend les textes de la page courante, y compris lors d'un changement de route reutilise. */
@Component({
  selector: 'app-page-legale',
  templateUrl: './page-legale.html',
})
export class PageLegale {
  protected readonly page = toSignal(
    inject(ActivatedRoute).data.pipe(
      map((donnees) => PAGES_LEGALES[donnees['page'] as NomPageLegale] ?? PAGES_LEGALES.mentions),
    ),
  );
}
