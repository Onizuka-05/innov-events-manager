import { ErreurHttp } from '../http/erreur-http.js';
import {
  EspaceClientRepository,
  type CompteProfil,
  type FicheProfil,
} from '../repositories/espace-client.repository.js';
import type { LogsRepository } from '../repositories/logs.repository.js';
import { LogsService } from './logs.service.js';
import type { MotsDePasseService } from './mots-de-passe.service.js';

/** Regles de l'espace client : profil, effacement du compte, avis et accord de publication. */
export class EspaceClientService {
  constructor(
    readonly repository: EspaceClientRepository,
    private readonly logs: LogsRepository,
    private readonly mots: MotsDePasseService,
  ) {}

  /** Un journal indisponible n'annule jamais une operation deja enregistree. */
  private async journal(type: string, acteur: string, details: Record<string, string | null>) {
    try {
      await new LogsService(this.logs).action(type, acteur, details);
    } catch {
      console.error(JSON.stringify({ evenement: 'journal_indisponible', type_action: type }));
    }
  }

  /** Verifie le mot de passe actuel ; meme message s'il manque ou s'il est faux. */
  private async verifierMotDePasse(idUtilisateur: string, valeur: string | null): Promise<void> {
    const valide =
      valeur !== null &&
      (await this.mots.verifier(await this.repository.hacheMotDePasse(idUtilisateur), valeur));
    if (!valide)
      throw new ErreurHttp(400, 'Mot de passe actuel incorrect.', 'MOT_DE_PASSE_ACTUEL_INVALIDE');
  }

  /**
   * Changer l'e-mail de connexion exige le mot de passe actuel. Une modification effective de la
   * fiche est journalisee avec l'identifiant du client seulement ; l'acteur est le client.
   */
  async modifierProfil(
    idUtilisateur: string,
    compte: CompteProfil | null,
    fiche: FicheProfil | null,
    motDePasseActuel: string | null,
  ) {
    if (compte) {
      const actuel = await this.repository.profil(idUtilisateur);
      if (actuel.compte.email_connexion.toLowerCase() !== compte.email_connexion.toLowerCase())
        await this.verifierMotDePasse(idUtilisateur, motDePasseActuel);
    }
    const { profil, fiche_modifiee } = await this.repository.modifierProfil(
      idUtilisateur,
      compte,
      fiche,
    );
    if (fiche_modifiee)
      await this.journal('MODIFICATION_CLIENT', idUtilisateur, { id_client: fiche_modifiee });
    return profil;
  }

  /**
   * Effacement demande par le client (CLI-04). Pour une fiche client, le journal
   * EFFACEMENT_CLIENT (identifiant seul, sans nom) est ecrit AVANT la transaction : c'est la
   * trace durable qui permet a la purge de reprendre le retrait du nom. Si MongoDB est
   * indisponible, rien n'est efface (503, a reessayer). Si la transaction echoue, le journal est
   * retire des que la base confirme que la fiche n'est pas anonymisee ; la purge, elle, ne
   * reprend que les fiches anonymisees.
   */
  async effacer(idUtilisateur: string, motDePasse: string): Promise<void> {
    await this.verifierMotDePasse(idUtilisateur, motDePasse);
    const idClient = await this.repository.ficheActive(idUtilisateur);
    if (!idClient) {
      // Sans fiche, aucun journal ne porte de nom : la trace est ecrite apres coup.
      await this.repository.effacer(idUtilisateur, null);
      await this.journal('EFFACEMENT_CLIENT', idUtilisateur, { id_client: null });
      return;
    }
    const horodatage = new Date();
    try {
      await this.logs.ajouter({
        horodatage,
        type_action: 'EFFACEMENT_CLIENT',
        id_utilisateur: idUtilisateur,
        details: { id_client: idClient },
      });
    } catch {
      console.error(
        JSON.stringify({ evenement: 'journal_indisponible', type_action: 'EFFACEMENT_CLIENT' }),
      );
      throw new ErreurHttp(
        503,
        'La suppression du compte est momentanément impossible. Réessayez dans quelques minutes.',
        'EFFACEMENT_INDISPONIBLE',
      );
    }
    try {
      await this.repository.effacer(idUtilisateur, idClient);
    } catch (erreur) {
      await this.annulerJournalEffacement(idClient, horodatage);
      throw erreur;
    }
    try {
      await this.logs.retirerNomClient([idClient]);
    } catch {
      console.error(JSON.stringify({ evenement: 'retrait_nom_journaux_echec' }));
    }
  }

  /** Retire le journal d'un effacement non abouti ; en cas de doute, il est conserve. */
  private async annulerJournalEffacement(idClient: string, horodatage: Date): Promise<void> {
    try {
      if (!(await this.repository.ficheAnonymisee(idClient)))
        await this.logs.retirerEffacementNonAbouti(idClient, horodatage);
    } catch {
      console.error(JSON.stringify({ evenement: 'journal_effacement_non_retire' }));
    }
  }
}
