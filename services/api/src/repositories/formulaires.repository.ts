import { ErreurHttp } from '../http/erreur-http.js';
import type { Pool } from 'pg';

export interface DemandeDevis {
  entreprise: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  lieu_souhaite: string;
  date_souhaitee: string;
  id_type_evenement: number;
  nb_participants: number;
  description_besoin: string;
}

/** Acces SQL des formulaires publics et du message de remerciement. */
export class FormulairesRepository {
  constructor(private readonly postgres: Pool) {}

  /** Options issues de la base, jamais une liste dupliquee dans le front. */
  async typesEvenement(): Promise<{ id_type_evenement: number; libelle: string }[]> {
    return (
      await this.postgres.query<{ id_type_evenement: number; libelle: string }>(
        'SELECT id_type_evenement, libelle FROM innov_events.types_evenement ORDER BY libelle',
      )
    ).rows;
  }

  /** Le statut et l'identifiant du client ne sont pas des champs publics. */
  async creerProspect(d: DemandeDevis): Promise<void> {
    await this.postgres.query(
      `INSERT INTO innov_events.prospects
      (entreprise, nom, prenom, email, telephone, lieu_souhaite, date_souhaitee, id_type_evenement, nb_participants, description_besoin, statut_prospect)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'a_contacter')`,
      [
        d.entreprise,
        d.nom,
        d.prenom,
        d.email,
        d.telephone,
        d.lieu_souhaite,
        d.date_souhaitee,
        d.id_type_evenement,
        d.nb_participants,
        d.description_besoin,
      ],
    );
  }

  /** Texte relu apres chaque demande, sans cache applicatif. */
  async remerciement(): Promise<string> {
    const resultat = await this.postgres.query<{ texte_remerciement: string }>(
      'SELECT texte_remerciement FROM innov_events.parametres WHERE id_parametres = 1',
    );
    return (
      resultat.rows[0]?.texte_remerciement ??
      'Merci, votre demande a bien été enregistrée. Notre équipe vous recontactera.'
    );
  }

  /** Modifie la ligne initialisee par le script, sans droit INSERT applicatif. */
  async modifierRemerciement(texte: string): Promise<void> {
    const resultat = await this.postgres.query(
      `UPDATE innov_events.parametres SET texte_remerciement = $1
      WHERE id_parametres = 1`,
      [texte],
    );
    if (resultat.rowCount !== 1)
      throw new ErreurHttp(503, 'Le paramétrage initial est indisponible.');
  }
}
