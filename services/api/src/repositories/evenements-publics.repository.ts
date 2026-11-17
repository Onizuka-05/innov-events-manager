import type { Pool } from 'pg';
import { ErreurHttp } from '../http/erreur-http.js';

/** Nombre d'evenements par page du catalogue public. */
export const EVENEMENTS_PAR_PAGE = 12;

/** Filtres valides par le controleur ; dates au format AAAA-MM-JJ. */
export interface FiltresPublics {
  du: string | null;
  au: string | null;
  id_type_evenement: number | null;
  id_theme: number | null;
  tri: 'recent' | 'ancien';
  page: number;
}

/**
 * Projection publique : ni prix, ni devis, ni coordonnees du client.
 * Condition de publication : accord du client, case « visible » cochee et statut autre que
 * brouillon (un evenement annule reste publie, avec son statut).
 */
const PROJECTION = `e.id_evenement::text,e.nom,to_json(e.date_debut)#>>'{}' AS date_debut,
 to_json(e.date_fin)#>>'{}' AS date_fin,e.lieu,e.statut_evenement,
 t.libelle AS libelle_type,th.libelle AS libelle_theme,e.image_url`;
const PUBLIE = `e.visible_public AND e.date_accord_publication IS NOT NULL
 AND e.statut_evenement<>'brouillon'`;
const SOURCE = `FROM innov_events.evenements e
 JOIN innov_events.types_evenement t ON t.id_type_evenement=e.id_type_evenement
 LEFT JOIN innov_events.themes th ON th.id_theme=e.id_theme`;
/** Une periode retient les evenements qui la chevauchent (jours entiers a l'heure de Paris). */
const FILTRES = `${PUBLIE}
 AND ($1::date IS NULL OR e.date_fin >= ($1::date)::timestamp AT TIME ZONE 'Europe/Paris')
 AND ($2::date IS NULL OR e.date_debut < ($2::date + 1)::timestamp AT TIME ZONE 'Europe/Paris')
 AND ($3::smallint IS NULL OR e.id_type_evenement=$3)
 AND ($4::smallint IS NULL OR e.id_theme=$4)`;

/** Lecture seule du catalogue public des evenements. */
export class EvenementsPublicsRepository {
  constructor(private readonly pool: Pool) {}

  /** Page filtree et triee sur la date de debut, avec le nombre total de resultats. */
  async lister(f: FiltresPublics) {
    const valeurs = [f.du, f.au, f.id_type_evenement, f.id_theme];
    const r = await this.pool.query<Record<string, unknown> & { total: string }>(
      `SELECT ${PROJECTION},COUNT(*) OVER() AS total ${SOURCE} WHERE ${FILTRES}
      ORDER BY CASE WHEN $5='ancien' THEN e.date_debut END ASC,
        CASE WHEN $5='recent' THEN e.date_debut END DESC,e.id_evenement
      LIMIT $6 OFFSET $7`,
      [...valeurs, f.tri, EVENEMENTS_PAR_PAGE, (f.page - 1) * EVENEMENTS_PAR_PAGE],
    );
    // Au-dela de la derniere page, la fenetre de comptage est vide : total recalcule.
    const total = r.rows[0]
      ? Number(r.rows[0].total)
      : Number(
          (
            await this.pool.query<{ total: string }>(
              `SELECT COUNT(*) AS total ${SOURCE} WHERE ${FILTRES}`,
              valeurs,
            )
          ).rows[0]!.total,
        );
    return {
      evenements: r.rows.map((ligne) => {
        const e: Record<string, unknown> = { ...ligne };
        delete e['total'];
        return e;
      }),
      total,
      page: f.page,
      par_page: EVENEMENTS_PAR_PAGE,
    };
  }

  /** Libelles des listes du formulaire de filtres. */
  async filtres() {
    const [types, themes] = await Promise.all([
      this.pool.query(
        'SELECT id_type_evenement,libelle FROM innov_events.types_evenement ORDER BY libelle',
      ),
      this.pool.query('SELECT id_theme,libelle FROM innov_events.themes ORDER BY libelle'),
    ]);
    return { types: types.rows, themes: themes.rows };
  }

  /** Detail d'un evenement publie ; un evenement non publie est introuvable. */
  async detail(id: string) {
    const e = (
      await this.pool.query(
        `SELECT ${PROJECTION} ${SOURCE} WHERE e.id_evenement=$1 AND ${PUBLIE}`,
        [id],
      )
    ).rows[0];
    if (!e) throw new ErreurHttp(404, 'Événement introuvable.');
    return e;
  }
}
