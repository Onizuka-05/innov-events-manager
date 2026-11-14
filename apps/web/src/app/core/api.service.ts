import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Appels de meme origine ; le cookie reste gere par le navigateur. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /** Lecture sans conserver de donnees de compte dans le stockage du navigateur. */
  get<T>(chemin: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`/api${chemin}`));
  }

  /** Obtient un jeton pour la session courante, notamment apres une connexion. */
  async modifier<T>(
    methode: 'POST' | 'PATCH' | 'DELETE',
    chemin: string,
    donnees: unknown = {},
  ): Promise<T> {
    const { jeton_csrf } = await this.get<{ jeton_csrf: string }>('/csrf');
    return firstValueFrom(
      this.http.request<T>(methode, `/api${chemin}`, {
        body: donnees,
        headers: { 'X-CSRF-Token': jeton_csrf },
      }),
    );
  }
}

/** Les messages HTTP publics sont affiches comme du texte par Angular. */
export function messageErreur(erreur: unknown): string {
  return erreur instanceof HttpErrorResponse && typeof erreur.error?.erreur === 'string'
    ? erreur.error.erreur
    : 'Le service est momentanément indisponible. Réessayez.';
}
