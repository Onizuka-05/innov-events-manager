import type { Request, Response } from 'express';
import { invalide } from '../http/validation.js';
import {
  EvenementsPublicsRepository,
  type FiltresPublics,
} from '../repositories/evenements-publics.repository.js';

const PARAMETRES = ['du', 'au', 'type', 'theme', 'tri', 'page'];

/** Date AAAA-MM-JJ existante (le 31 fevrier est refuse). */
function jour(v: unknown): string | null {
  if (v === undefined || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(v)) invalide();
  const d = new Date(`${v as string}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) invalide();
  return v as string;
}
function nombre(v: unknown, max: number): number | null {
  if (v === undefined || v === '') return null;
  if (typeof v !== 'string' || !/^[1-9][0-9]{0,4}$/u.test(v) || Number(v) > max) invalide();
  return Number(v);
}

/** Catalogue public : parametres valides un par un, tout parametre inconnu est refuse. */
export class EvenementsPublicsController {
  constructor(private readonly repository: EvenementsPublicsRepository) {}
  lister = async (r: Request, s: Response) => {
    if (Object.keys(r.query).some((k) => !PARAMETRES.includes(k))) invalide();
    // Un parametre vide (champ de formulaire non rempli) vaut sa valeur par defaut.
    const tri = r.query['tri'] || 'recent';
    if (tri !== 'recent' && tri !== 'ancien') invalide();
    const filtres: FiltresPublics = {
      du: jour(r.query['du']),
      au: jour(r.query['au']),
      id_type_evenement: nombre(r.query['type'], 32767),
      id_theme: nombre(r.query['theme'], 32767),
      tri: tri as FiltresPublics['tri'],
      page: nombre(r.query['page'], 9999) ?? 1,
    };
    if (filtres.du && filtres.au && filtres.du > filtres.au) invalide();
    s.json(await this.repository.lister(filtres));
  };
  filtres = async (_r: Request, s: Response) => {
    s.json(await this.repository.filtres());
  };
  detail = async (r: Request, s: Response) => {
    const id = r.params['id'];
    if (typeof id !== 'string' || !/^[1-9][0-9]{0,17}$/u.test(id)) invalide();
    s.json(await this.repository.detail(id as string));
  };
}
