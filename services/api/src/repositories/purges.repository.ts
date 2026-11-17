import type { Pool } from 'pg';

/** Requetes SQL des purges automatiques. */
export class PurgesRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Supprime les demandes classees sans suite dont le dernier contact date de plus de 3 ans.
   * Renvoie le nombre de demandes supprimees.
   */
  async supprimerProspectsEchoues(): Promise<number> {
    const r = await this.pool.query(
      `DELETE FROM innov_events.prospects
      WHERE statut_prospect='echoue' AND date_dernier_contact < NOW() - INTERVAL '3 years'`,
    );
    return r.rowCount ?? 0;
  }

  /**
   * Parmi les fiches donnees, celles qui sont anonymisees. Un journal d'effacement n'est
   * repris que si l'effacement a bien abouti en base.
   */
  async fichesAnonymisees(idsClients: readonly string[]): Promise<string[]> {
    const ids = idsClients.filter((id) => /^[1-9][0-9]{0,17}$/u.test(id));
    if (ids.length === 0) return [];
    const r = await this.pool.query<{ id_client: string }>(
      `SELECT id_client::text FROM innov_events.clients
      WHERE id_client = ANY($1::bigint[]) AND date_anonymisation IS NOT NULL`,
      [ids],
    );
    return r.rows.map((l) => l.id_client);
  }
}
