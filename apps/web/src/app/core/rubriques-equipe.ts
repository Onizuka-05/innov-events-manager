import type { IsActiveMatchOptions } from '@angular/router';
import type { Utilisateur } from './authentification.service';

/** Rubrique du menu de l'equipe. */
export interface RubriqueEquipe {
  chemin: string;
  libelle: string;
}

const RUBRIQUES: (RubriqueEquipe & { admin: boolean })[] = [
  { chemin: '/administration', libelle: 'Tableau de bord', admin: true },
  { chemin: '/administration/prospects', libelle: 'Prospects', admin: true },
  { chemin: '/administration/clients', libelle: 'Clients', admin: false },
  { chemin: '/administration/evenements', libelle: 'Événements', admin: false },
  { chemin: '/administration/devis', libelle: 'Devis', admin: true },
  { chemin: '/administration/taches', libelle: 'Tâches', admin: false },
  { chemin: '/administration/avis', libelle: 'Avis', admin: false },
  { chemin: '/administration/comptes', libelle: 'Comptes', admin: true },
  { chemin: '/administration/journaux', libelle: 'Journaux', admin: true },
  { chemin: '/administration/parametres', libelle: 'Paramètres', admin: true },
];

/** Vrai pour les roles de l'equipe ; l'API controle les droits a chaque appel. */
export function estEquipe(role: Utilisateur['role'] | undefined): boolean {
  return role === 'admin' || role === 'employe';
}

/**
 * Rubriques affichees selon le role. L'employe voit seulement ses rubriques ;
 * les autres restent refusees par les gardes et par l'API.
 */
export function rubriquesEquipe(role: Utilisateur['role'] | undefined): RubriqueEquipe[] {
  if (!estEquipe(role)) return [];
  return RUBRIQUES.filter((r) => role === 'admin' || !r.admin).map(({ chemin, libelle }) => ({
    chemin,
    libelle: libelle === 'Tâches' && role !== 'admin' ? 'Mes tâches' : libelle,
  }));
}

/** Options communes : la rubrique reste active avec un identifiant de fiche dans l'URL. */
export const OPTIONS_RUBRIQUE_ACTIVE: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};
