import type { MongoClient } from 'mongodb';
import type { Pool } from 'pg';

/** Limite les acces aux bases aux repositories. */
export class SanteRepository {
  constructor(
    private readonly postgres: Pick<Pool, 'query'>,
    private readonly mongo: Pick<MongoClient, 'db'>,
    private readonly mongoDatabase: string,
  ) {}

  async verifierPostgresql(): Promise<void> {
    await this.postgres.query('SELECT 1');
  }

  async verifierMongodb(): Promise<void> {
    await this.mongo.db(this.mongoDatabase).command({ ping: 1 });
  }
}
