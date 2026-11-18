import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ErreurHttp } from '../http/erreur-http.js';
import {
  DevisRepository,
  type DevisDetail,
  type LigneDevis,
} from '../repositories/devis.repository.js';
import { LogsService } from './logs.service.js';
import type { EnvoiCourriels } from './courriels.service.js';
import { MotsDePasseService } from './mots-de-passe.service.js';
import { DevisPdfService } from './devis-pdf.service.js';

/** Regles metier du parcours devis et journalisation structuree. */
export class DevisService {
  constructor(
    readonly repository: DevisRepository,
    private readonly courriels: EnvoiCourriels,
    private readonly mots: MotsDePasseService,
    private readonly logs: LogsService,
    private readonly contact: string,
    private readonly pdf: DevisPdfService,
  ) {}

  async journal(
    type_action: string,
    id_utilisateur: string,
    details: Record<string, string | number | null>,
  ) {
    await this.logs.action(type_action, id_utilisateur, details);
  }
  /** Le classement n'est enregistre que si le message au prospect est parti. */
  async echouer(id: string, message: string, acteur: string) {
    await this.repository.echouer(id, async (p) => {
      try {
        await this.courriels.envoyer({
          destinataire: p.email,
          titre: 'Suite à votre demande Innov’Events',
          texte: `Bonjour ${p.prenom} ${p.nom},\n${message}\nCordialement, Innov’Events`,
        });
      } catch {
        throw new ErreurHttp(
          503,
          'Le message n’a pas pu être envoyé : la demande reste à contacter. Réessayez plus tard.',
        );
      }
    });
    await this.journal('ECHEC_PROSPECT', acteur, { id_prospect: id });
  }
  async creerEvenement(d: Parameters<DevisRepository['creerEvenement']>[0], acteur: string) {
    const id = await this.repository.creerEvenement(d);
    await this.journal('CREATION_EVENEMENT', acteur, { id_evenement: id });
    return { id_evenement: id };
  }
  async creerDevis(id: string, intitule: string) {
    return { id_devis: await this.repository.creerDevis(id, intitule) };
  }
  async remplacerLignes(id: string, lignes: LigneDevis[]) {
    await this.repository.remplacerLignes(id, lignes);
  }
  async consulter(id: string, idUtilisateur: string, role: string) {
    if (role === 'client' && !(await this.repository.possede(id, idUtilisateur)))
      throw new ErreurHttp(404, 'Devis introuvable.');
    const d = await this.repository.detail(id);
    return { ...d, totaux: this.totaux(d) };
  }
  totaux(d: DevisDetail) {
    // Les centimes sont additionnes avant l'arrondi de TVA, pour limiter les erreurs de flottants.
    const htCentimes = d.lignes.reduce((s, l) => s + Math.round(Number(l.montant_ht) * 100), 0);
    const tvaCentimes = Math.round((htCentimes * Number(d.taux_tva_applique)) / 100);
    return {
      total_ht: (htCentimes / 100).toFixed(2),
      total_tva: (tvaCentimes / 100).toFixed(2),
      total_ttc: ((htCentimes + tvaCentimes) / 100).toFixed(2),
    };
  }

  /** Cree le compte seulement si besoin, et rattache la fiche sous verrou SQL. */
  private async compteClient(
    db: PoolClient,
    d: DevisDetail,
  ): Promise<{ email: string; temporaire: string | null }> {
    const ficheLiee = await db.query<{
      id_utilisateur: string | null;
      prenom_contact: string;
      nom_contact: string;
    }>(
      `SELECT id_utilisateur::text,prenom_contact,nom_contact FROM innov_events.clients
       WHERE id_client=$1 AND date_anonymisation IS NULL FOR UPDATE`,
      [d.id_client],
    );
    if (!ficheLiee.rows[0]) throw new ErreurHttp(404, 'Client introuvable.');
    if (ficheLiee.rows[0].id_utilisateur) {
      const rattache = await db.query<{
        email_connexion: string;
        role: string;
        statut_compte: string;
      }>(
        `SELECT email_connexion,role,statut_compte FROM innov_events.utilisateurs WHERE id_utilisateur=$1 FOR UPDATE`,
        [ficheLiee.rows[0].id_utilisateur],
      );
      if (rattache.rows[0]?.role !== 'client' || rattache.rows[0].statut_compte !== 'actif')
        throw new ErreurHttp(409, 'Le compte client rattaché est indisponible.');
      return { email: rattache.rows[0].email_connexion, temporaire: null };
    }
    if (!d.email_contact) throw new ErreurHttp(409, 'Le contact du client est incomplet.');
    const compte = await db.query<{ id_utilisateur: string; role: string; statut_compte: string }>(
      `SELECT id_utilisateur::text,role,statut_compte FROM innov_events.utilisateurs
       WHERE LOWER(email_connexion)=LOWER($1) FOR UPDATE`,
      [d.email_contact],
    );
    if (compte.rows[0]) {
      if (compte.rows[0].role !== 'client' || compte.rows[0].statut_compte !== 'actif')
        throw new ErreurHttp(409, 'Le compte associé à ce contact est indisponible.');
      const lie = await db.query<{ id_client: string }>(
        `SELECT id_client::text FROM innov_events.clients WHERE id_utilisateur=$1`,
        [compte.rows[0].id_utilisateur],
      );
      if (lie.rows[0] && lie.rows[0].id_client !== d.id_client)
        throw new ErreurHttp(409, 'Ce compte est déjà rattaché à une autre fiche client.');
      const idCompte = compte.rows[0].id_utilisateur;
      // Ce compte a ete cree avec une adresse jamais verifiee : quiconque l'a saisie connait son
      // mot de passe. Il est remplace par un temporaire envoye a l'adresse de contact et les
      // sessions sont detruites : seul le titulaire de la boite peut lire le devis.
      const temporaire = this.mots.genererTemporaire();
      await db.query(
        `UPDATE innov_events.utilisateurs SET mot_de_passe_hache=NULL,mdp_temporaire_hache=$2,
        mdp_temporaire_expire_le=clock_timestamp()+INTERVAL '7 days' WHERE id_utilisateur=$1`,
        [idCompte, await this.mots.hacher(temporaire)],
      );
      await db.query(
        `DELETE FROM innov_events.sessions WHERE sess->'authentification'->>'id_utilisateur'=$1`,
        [idCompte],
      );
      await db.query(`UPDATE innov_events.clients SET id_utilisateur=$2 WHERE id_client=$1`, [
        d.id_client,
        idCompte,
      ]);
      return { email: d.email_contact, temporaire };
    }
    const fiche = await db.query<{ prenom_contact: string; nom_contact: string }>(
      `SELECT prenom_contact,nom_contact
      FROM innov_events.clients WHERE id_client=$1 FOR UPDATE`,
      [d.id_client],
    );
    if (!fiche.rows[0]) throw new ErreurHttp(404, 'Client introuvable.');
    const temporaire = this.mots.genererTemporaire();
    const hache = await this.mots.hacher(temporaire);
    const nomUtilisateur = `client-${randomUUID().slice(0, 18)}`;
    const r = await db.query<{ id_utilisateur: string }>(
      `INSERT INTO innov_events.utilisateurs
      (email_connexion,nom_utilisateur,prenom,nom,role,mdp_temporaire_hache,mdp_temporaire_expire_le)
      VALUES ($1,$2,$3,$4,'client',$5,clock_timestamp()+INTERVAL '7 days')
      RETURNING id_utilisateur::text`,
      [
        d.email_contact,
        nomUtilisateur,
        fiche.rows[0].prenom_contact,
        fiche.rows[0].nom_contact,
        hache,
      ],
    );
    await db.query(`UPDATE innov_events.clients SET id_utilisateur=$2 WHERE id_client=$1`, [
      d.id_client,
      r.rows[0]!.id_utilisateur,
    ]);
    return { email: d.email_contact, temporaire };
  }

  /** Le statut et le temporaire ne sont valides que si l'envoi fonctionne. */
  async envoyer(id: string, acteur: string) {
    const d = await this.repository.preparerEnvoi(id, async (db, devis) => {
      const compte = await this.compteClient(db, devis);
      const pdf = await this.pdf.generer(devis);
      await this.courriels.envoyer({
        destinataire: compte.email,
        titre: `Devis Innov’Events : ${devis.intitule}`,
        texte: `Bonjour, votre devis « ${devis.intitule} » est disponible dans votre espace client.\nConnectez-vous avec ${compte.email}.${compte.temporaire ? `\nMot de passe temporaire (7 jours, une seule connexion) : ${compte.temporaire}\nChangez-le à votre première connexion.` : ''}\nMontant TTC : ${this.totaux(devis).total_ttc} €.\nContact : ${this.contact}`,
        piecesJointes: [{ nom: `devis-${id}.pdf`, contenu: pdf }],
      });
    });
    await this.journal('ENVOI_DEVIS', acteur, { id_devis: id, id_evenement: d.id_evenement });
  }
  async genererPdf(id: string, acteur: string) {
    const pdf = await this.pdf.generer(await this.repository.detail(id));
    await this.journal('GENERATION_PDF', acteur, { id_devis: id });
    return pdf;
  }
  async repondre(
    id: string,
    utilisateur: string,
    choix: 'accepte' | 'refuse' | 'modification',
    motif: string,
  ) {
    const evenementChange = await this.repository.repondre(id, utilisateur, choix, motif);
    await this.journal('REPONSE_DEVIS', utilisateur, { id_devis: id, statut_devis: choix });
    if (choix === 'accepte') {
      const d = await this.repository.detail(id);
      if (evenementChange)
        await this.journal('CHANGEMENT_STATUT_EVENEMENT', utilisateur, {
          id_evenement: d.id_evenement,
          ancien: 'brouillon',
          nouveau: 'accepte',
        });
      try {
        await this.courriels.envoyer({
          destinataire: this.contact,
          titre: 'Un devis a été accepté',
          texte: `Devis n° ${id} accepté par un client.`,
        });
      } catch {
        // La decision du client reste acquise ; ligne identifiable dans les logs pour la relance.
        console.info(
          JSON.stringify({ evenement: 'notification_acceptation_echouee', id_devis: id }),
        );
      }
    }
  }
}
