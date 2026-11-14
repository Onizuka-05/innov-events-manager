import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Presentation publique de l'agence et point d'entree vers la demande de devis. */
@Component({
  selector: 'app-accueil',
  imports: [RouterLink],
  templateUrl: './accueil.html',
  styleUrl: './accueil.css',
})
export class Accueil {}
