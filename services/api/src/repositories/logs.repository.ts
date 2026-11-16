import type { MongoClient } from 'mongodb';

/** Journaux contenant une adresse IP, effaces automatiquement apres 180 jours. */
export const TYPES_JOURNAUX_CONNEXION = ['CONNEXION_REUSSIE', 'CONNEXION_ECHOUEE'] as const;
export const DUREE_JOURNAUX_CONNEXION_SECONDES = 180 * 24 * 60 * 60;

export interface Journal {
  horodatage: Date;
  type_action: string;
  id_utilisateur: string | null;
  details: Record<string, string | number | null>;
}

/** Seul point d'ecriture de la collection logs ; Date devient un BSON ISODate. */
export class LogsRepository {
  constructor(
    private readonly mongodb: MongoClient,
    private readonly base: string,
  ) {}

  /** Persiste une structure commune sans ajouter de champs de requete. */
  async ajouter(journal: Journal): Promise<void> {
    await this.mongodb.db(this.base).collection<Journal>('logs').insertOne(journal);
  }

  /** Page de 50 journaux, sans projection des champs BSON internes. */
  async lister(type: string, page: number) {
    const filtre = type ? { type_action: type } : {};
    return this.mongodb
      .db(this.base)
      .collection<Journal>('logs')
      .find(filtre, {
        projection: { _id: 0, horodatage: 1, type_action: 1, id_utilisateur: 1, details: 1 },
      })
      .sort({ horodatage: -1, _id: -1 })
      .skip((page - 1) * 50)
      .limit(50)
      .toArray();
  }

  /**
   * Index TTL partiel : seuls les journaux de connexion expirent. La creation est idempotente,
   * donc relancee sans risque a chaque demarrage ; les journaux anterieurs sont aussi purges.
   */
  async preparerIndexExpiration(): Promise<void> {
    await this.mongodb
      .db(this.base)
      .collection<Journal>('logs')
      .createIndex(
        { horodatage: 1 },
        {
          name: 'ttl_journaux_connexion',
          expireAfterSeconds: DUREE_JOURNAUX_CONNEXION_SECONDES,
          partialFilterExpression: {
            type_action: { $in: [...TYPES_JOURNAUX_CONNEXION] },
          },
        },
      );
  }
}
