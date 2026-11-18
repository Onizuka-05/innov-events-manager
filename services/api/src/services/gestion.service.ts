import type { EnvoiCourriels } from './courriels.service.js';
import { ErreurHttp } from '../http/erreur-http.js';
import { GestionRepository } from '../repositories/gestion.repository.js';
import { LogsRepository } from '../repositories/logs.repository.js';
import { LogsService } from './logs.service.js';
import { MotsDePasseService } from './mots-de-passe.service.js';
import type { ClientSaisie, CompteSaisie, EvenementModification } from './gestion.types.js';

/** Verifie les transitions du cycle de l'evenement, sans retour depuis un etat final. */
export function verifierStatutEvenement(ancien: string, nouveau: string): void {
  const transitions: Record<string, string[]> = {
    brouillon: ['accepte', 'annule'],
    accepte: ['en_cours', 'annule'],
    en_cours: ['termine', 'annule'],
    termine: [],
    annule: [],
  };
  if (ancien !== nouveau && !transitions[ancien]?.includes(nouveau))
    throw new ErreurHttp(409, 'Transition de l’événement interdite.');
}
/** Une tache avance d'une etape et ne peut pas etre rouverte. */
export function verifierStatutTache(ancien: string, nouveau: string): void {
  if (!(
    (ancien === 'a_faire' && nouveau === 'en_cours') ||
    (ancien === 'en_cours' && nouveau === 'termine')
  ))
    throw new ErreurHttp(409, 'Transition de la tâche interdite.');
}
/** Regles de gestion et journalisation des operations administratives. */
export class GestionService {
  constructor(
    readonly repository: GestionRepository,
    private readonly logs: LogsRepository,
    private readonly courriels: EnvoiCourriels,
  ) {}
  private async journal(type: string, acteur: string, details: Record<string, string | null>) {
    try {
      await new LogsService(this.logs).action(type, acteur, details);
    } catch {
      console.error(JSON.stringify({ evenement: 'journal_indisponible', type_action: type }));
    }
  }
  /** Le nom apparait uniquement dans les actions qui l'exigent. */
  async enregistrerClient(d: ClientSaisie, acteur: string, id?: string) {
    const c = await this.repository.enregistrerClient(d, id);
    await this.journal(
      id ? 'MODIFICATION_CLIENT' : 'CREATION_CLIENT',
      acteur,
      id
        ? { id_client: c.id_client }
        : { id_client: c.id_client, nom_client: d.prenom_contact + ' ' + d.nom_contact },
    );
    return c;
  }
  /** Suppression administrative : le journal conserve le nom du client. */
  async supprimerClient(id: string, acteur: string) {
    const nom = await this.repository.supprimerClient(id);
    await this.journal('SUPPRESSION_CLIENT', acteur, { id_client: id, nom_client: nom });
  }
  /** Aucun role admin ne peut etre cree depuis cet espace. */
  async creerCompte(d: CompteSaisie) {
    const mots = new MotsDePasseService();
    const temporaire = mots.genererTemporaire();
    return this.repository.creerCompte(d, await mots.hacher(temporaire), async () => {
      try {
        await this.courriels.envoyer({
          destinataire: d.email_connexion,
          titre: 'Votre compte Innov’Events',
          texte: `Bonjour ${d.prenom}, votre compte a été créé.\nMot de passe temporaire : ${temporaire}\nValable 7 jours, pour une seule connexion. Choisissez votre propre mot de passe à la première connexion. Après expiration, utilisez « mot de passe oublié ».`,
        });
      } catch {
        throw new ErreurHttp(
          503,
          'Le message n’a pas pu être envoyé : aucun compte créé. Réessayez.',
        );
      }
    });
  }
  /** La suppression d'un compte rattache journalise aussi la suppression de sa fiche. */
  async supprimerCompte(id: string, acteur: string) {
    const c = await this.repository.supprimerCompte(id, acteur);
    if (c) await this.journal('SUPPRESSION_CLIENT', acteur, c);
  }
  /** Statut et donnees sont enregistres dans une seule transaction. */
  async modifierEvenement(id: string, d: EvenementModification, acteur: string) {
    const ancien = await this.repository.modifierEvenement(id, d, verifierStatutEvenement);
    if (ancien !== d.statut_evenement)
      await this.journal('CHANGEMENT_STATUT_EVENEMENT', acteur, {
        id_evenement: id,
        ancien: ancien,
        nouveau: d.statut_evenement,
      });
  }
  /** Lecture admin seule, filtree par une valeur et jamais par un objet MongoDB utilisateur. */
  journaux(type: string, page: number) {
    return this.logs.lister(type, page);
  }
}
