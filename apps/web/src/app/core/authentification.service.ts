import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from './api.service';

export interface Utilisateur {
  id_utilisateur: string;
  email_connexion: string;
  nom_utilisateur: string;
  prenom: string;
  nom: string;
  role: 'client' | 'employe' | 'admin';
}

/** Etat d'interface seulement ; les droits sont controles par l'API. */
@Injectable({ providedIn: 'root' })
export class AuthentificationService {
  private readonly api = inject(ApiService);
  readonly utilisateur = signal<Utilisateur | null>(null);
  readonly restreinte = signal(false);

  /** Recharge la session lors d'un acces protege, y compris apres rechargement de page. */
  async charger(): Promise<void> {
    try {
      const reponse = await this.api.get<{ utilisateur: Utilisateur }>('/sessions/courante');
      this.utilisateur.set(reponse.utilisateur);
      this.restreinte.set(false);
    } catch (erreur) {
      this.utilisateur.set(null);
      this.restreinte.set(
        erreur instanceof HttpErrorResponse && erreur.error?.code === 'CHANGEMENT_MDP_REQUIS',
      );
      if (!(erreur instanceof HttpErrorResponse) || ![401, 403].includes(erreur.status))
        throw erreur;
    }
  }

  /** Une connexion regenere le cookie et invalide le jeton CSRF precedent. */
  async connecter(donnees: unknown): Promise<void> {
    const reponse = await this.api.modifier<{
      utilisateur?: Utilisateur;
      changement_mdp_requis: boolean;
    }>('POST', '/sessions', donnees);
    this.utilisateur.set(reponse.utilisateur ?? null);
    this.restreinte.set(reponse.changement_mdp_requis);
  }

  /** Detruit la session cote serveur avant de masquer l'espace. */
  async deconnecter(): Promise<void> {
    await this.api.modifier('DELETE', '/sessions');
    this.utilisateur.set(null);
    this.restreinte.set(false);
  }
}

/** Une destination reste interne a l'application et ne peut jamais devenir une URL externe. */
export function retourInterne(valeur: string | null): string {
  return valeur &&
    /^\/(?!\/)/u.test(valeur) &&
    ![...valeur].some((c) => c === '\\' || c.charCodeAt(0) <= 32) &&
    !/^\/(connexion|inscription|mot-de-passe-oublie|nouveau-mot-de-passe)(?:[/?#]|$)/u.test(valeur)
    ? valeur
    : '/espace';
}
