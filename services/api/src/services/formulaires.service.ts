import { ErreurHttp } from '../http/erreur-http.js';
import {
  FormulairesRepository,
  type DemandeDevis,
} from '../repositories/formulaires.repository.js';
import type { EnvoiCourriels } from './courriels.service.js';

export interface Contact {
  nom_utilisateur: string;
  email: string;
  titre: string;
  description: string;
}

/** Enregistre les demandes et transmet les messages a l'adresse generique. */
export class FormulairesService {
  constructor(
    private readonly repository: FormulairesRepository,
    private readonly courriels: EnvoiCourriels,
    private readonly adresseContact: string,
  ) {}

  /** Le nom saisi est declaratif, il ne confere aucun droit. */
  async contacter(d: Contact): Promise<void> {
    await this.courriels.envoyer({
      destinataire: this.adresseContact,
      titre: `Contact : ${d.titre.replace(/[\r\n]/gu, ' ')}`,
      texte: `Nom d’utilisateur déclaré : ${d.nom_utilisateur || 'Non renseigné'}\nE-mail : ${d.email || 'Non renseigné'}\n\n${d.description}`,
      repondreA: d.email || undefined,
    });
  }

  /** La demande est conservee meme si le service d'e-mail ne repond pas. */
  async demander(
    d: DemandeDevis,
  ): Promise<{ texte_remerciement: string; notification_envoyee: boolean }> {
    if (
      !(await this.repository.typesEvenement()).some(
        (type) => type.id_type_evenement === d.id_type_evenement,
      )
    ) {
      throw new ErreurHttp(400, 'Choisissez un type d’événement disponible.');
    }
    await this.repository.creerProspect(d);
    let notification = true;
    try {
      await this.courriels.envoyer({
        destinataire: this.adresseContact,
        titre: 'Nouvelle demande de devis',
        texte: Object.entries(d)
          .map(([cle, valeur]) => `${cle} : ${valeur}`)
          .join('\n'),
        repondreA: d.email,
      });
    } catch {
      notification = false;
      console.info(JSON.stringify({ evenement: 'notification_devis_indisponible' }));
    }
    return {
      texte_remerciement: await this.repository.remerciement(),
      notification_envoyee: notification,
    };
  }
}
