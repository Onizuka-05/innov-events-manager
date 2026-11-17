import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/** Presentation publique de l'agence et point d'entree vers la demande de devis. */
@Component({
  selector: 'app-accueil',
  imports: [RouterLink],
  templateUrl: './accueil.html',
  styleUrl: './accueil.css',
})
export class Accueil {
  protected readonly compteSupprime =
    inject(ActivatedRoute).snapshot.queryParamMap.get('compte_supprime') === '1';
}
