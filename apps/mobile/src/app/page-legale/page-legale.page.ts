import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular';

import { PAGES_LEGALES, VERSION_LEGALE, type NomPageLegale } from './contenus-legaux';

/** CGU et CGV lisibles sur telephone, sans connexion (MOB-07). */
@Component({
  selector: 'app-page-legale',
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonContent],
  templateUrl: './page-legale.page.html',
})
export class PageLegalePage {
  private readonly nom = inject(ActivatedRoute).snapshot.data['page'] as NomPageLegale;
  protected readonly contenu = PAGES_LEGALES[this.nom] ?? PAGES_LEGALES.cgu;
  protected readonly version = VERSION_LEGALE;
  /** Lien vers l'autre document, pour passer des CGU aux CGV et inversement. */
  protected readonly autre =
    this.nom === 'cgv'
      ? { lien: '/cgu', libelle: PAGES_LEGALES.cgu.titre }
      : { lien: '/cgv', libelle: PAGES_LEGALES.cgv.titre };
}
