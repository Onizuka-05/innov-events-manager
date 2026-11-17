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
   * Retire le nom des journaux des clients qui ont demande l'effacement de leur compte.
   * Idempotent : un journal sans nom n'est pas modifie. Renvoie le nombre de journaux modifies.
   */
  async retirerNomClient(idsClients: readonly string[]): Promise<number> {
    if (idsClients.length === 0) return 0;
    const resultat = await this.mongodb
      .db(this.base)
      .collection<Journal>('logs')
      .updateMany(
        { 'details.id_client': { $in: [...idsClients] }, 'details.nom_client': { $exists: true } },
        { $unset: { 'details.nom_client': '' } },
      );
    return resultat.modifiedCount;
  }

  /**
   * Retire le journal EFFACEMENT_CLIENT ecrit avant un effacement qui n'a pas abouti en base.
   * Le journal est designe par la fiche et son horodatage exact.
   */
  async retirerEffacementNonAbouti(idClient: string, horodatage: Date): Promise<void> {
    await this.mongodb.db(this.base).collection<Journal>('logs').deleteOne({
      type_action: 'EFFACEMENT_CLIENT',
      'details.id_client': idClient,
      horodatage,
    });
  }

  /** Identifiants des fiches effacees a la demande du client (journaux EFFACEMENT_CLIENT). */
  async clientsEffaces(): Promise<string[]> {
    const ids = await this.mongodb
      .db(this.base)
      .collection<Journal>('logs')
      .distinct('details.id_client', { type_action: 'EFFACEMENT_CLIENT' });
    return ids.filter((id): id is string => typeof id === 'string');
  }

  /**
   * Supprime les journaux anterieurs a la date donnee, hors journaux de connexion,
   * qui restent geres par l'index d'expiration. Renvoie le nombre de journaux supprimes.
   */
  async supprimerAnterieurs(limite: Date): Promise<number> {
    const resultat = await this.mongodb
      .db(this.base)
      .collection<Journal>('logs')
      .deleteMany({
        type_action: { $nin: [...TYPES_JOURNAUX_CONNEXION] },
        horodatage: { $lt: limite },
      });
    return resultat.deletedCount;
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
