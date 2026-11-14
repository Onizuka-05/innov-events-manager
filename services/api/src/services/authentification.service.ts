import { ErreurHttp } from '../http/erreur-http.js';
import {
  UtilisateursRepository,
  type Inscription,
  type Utilisateur,
} from '../repositories/utilisateurs.repository.js';
import type { EnvoiCourriels } from './courriels.service.js';
import { LogsService } from './logs.service.js';
import { MotsDePasseService, preuveSession } from './mots-de-passe.service.js';

export interface AuthSession {
  id_utilisateur: string;
  mode: 'normale' | 'restreinte';
  preuve: string;
  expire_le: number;
}
declare module 'express-session' {
  interface SessionData {
    authentification?: AuthSession;
  }
}

/** Regles d'inscription, de connexion et de renouvellement du mot de passe. */
export class AuthentificationService {
  private readonly hacheLeurre: Promise<string>;
  constructor(
    private readonly comptes: UtilisateursRepository,
    private readonly mots: MotsDePasseService,
    private readonly courriels: EnvoiCourriels,
    private readonly logs: LogsService,
  ) {
    this.hacheLeurre = mots.hacher(mots.genererTemporaire());
  }

  /** Reponse neutre si un e-mail ou un nom d'utilisateur existe deja. */
  async inscrire(donnees: Inscription, motDePasse: string): Promise<void> {
    if (await this.comptes.inscrire(donnees, await this.mots.hacher(motDePasse))) {
      try {
        await this.courriels.envoyer({
          destinataire: donnees.email_connexion,
          titre: 'Votre inscription Innov’Events',
          texte: `Bonjour ${donnees.prenom}, votre compte client a été créé. Vous pouvez vous connecter avec le mot de passe choisi.`,
        });
      } catch {
        console.info(JSON.stringify({ evenement: 'courriel_inscription_indisponible' }));
      }
    }
  }

  /** Compare les mots de passe avant de consommer atomiquement un temporaire. */
  async connecter(
    email: string,
    motDePasse: string,
    ip: string,
  ): Promise<{ auth: AuthSession; utilisateur: Utilisateur }> {
    const utilisateur = await this.comptes.parEmail(email);
    const normalValide = await this.mots.verifier(
      utilisateur?.mot_de_passe_hache ?? (await this.hacheLeurre),
      motDePasse,
    );
    const temporaireValide = await this.mots.verifier(
      utilisateur?.mdp_temporaire_hache ?? (await this.hacheLeurre),
      motDePasse,
    );
    if (utilisateur?.statut_compte === 'actif') {
      if (normalValide && utilisateur.mot_de_passe_hache) {
        await this.logs.connexion(utilisateur.id_utilisateur, ip);
        return {
          utilisateur,
          auth: {
            id_utilisateur: utilisateur.id_utilisateur,
            mode: 'normale',
            preuve: preuveSession(utilisateur.mot_de_passe_hache),
            expire_le: Date.now() + 8 * 60 * 60000,
          },
        };
      }
      if (temporaireValide && utilisateur.mdp_temporaire_hache) {
        const consommation = await this.comptes.consommerTemporaire(
          utilisateur.id_utilisateur,
          utilisateur.mdp_temporaire_hache,
        );
        if (consommation) {
          await this.logs.connexion(utilisateur.id_utilisateur, ip);
          return {
            utilisateur,
            auth: {
              id_utilisateur: utilisateur.id_utilisateur,
              mode: 'restreinte',
              preuve: preuveSession(utilisateur.mdp_temporaire_hache, consommation),
              expire_le: Date.now() + 15 * 60000,
            },
          };
        }
      }
    }
    await this.logs.echec(email, ip);
    throw new ErreurHttp(401, 'E-mail ou mot de passe incorrect.');
  }

  /** Meme traitement cryptographique et meme reponse publique, compte present ou absent. */
  async oublier(email: string): Promise<void> {
    const temporaire = this.mots.genererTemporaire();
    const hache = await this.mots.hacher(temporaire);
    const utilisateur = await this.comptes.parEmail(email);
    if (
      utilisateur?.statut_compte === 'actif' &&
      (await this.comptes.preparerOubli(utilisateur.id_utilisateur, hache))
    ) {
      try {
        await this.courriels.envoyer({
          destinataire: utilisateur.email_connexion,
          titre: 'Mot de passe temporaire Innov’Events',
          texte: `Votre mot de passe temporaire : ${temporaire}\nValable une heure et pour une seule connexion. Vous devrez choisir un nouveau mot de passe dans les 15 minutes suivantes. Votre mot de passe actuel reste utilisable. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.`,
        });
      } catch {
        console.info(JSON.stringify({ evenement: 'courriel_oubli_indisponible' }));
      }
    }
  }

  /** Une session normale est invalidee au changement du mot de passe ; une restreinte a la nouvelle demande d'oubli. */
  async verifierSession(auth: AuthSession): Promise<Utilisateur> {
    if (auth.expire_le <= Date.now()) throw new ErreurHttp(401, 'Session expirée.');
    const compte = await this.comptes.parId(auth.id_utilisateur);
    if (!compte || compte.statut_compte !== 'actif') throw new ErreurHttp(401, 'Session invalide.');
    const preuve =
      auth.mode === 'normale'
        ? compte.mot_de_passe_hache && preuveSession(compte.mot_de_passe_hache)
        : compte.mdp_temporaire_hache &&
          compte.mdp_temporaire_expire_le &&
          preuveSession(compte.mdp_temporaire_hache, compte.mdp_temporaire_expire_le);
    if (preuve !== auth.preuve) throw new ErreurHttp(401, 'Session invalide.');
    return compte;
  }

  /** Efface le temporaire dans la meme requete qui enregistre le nouveau hache. */
  async changer(auth: AuthSession, motDePasse: string): Promise<AuthSession> {
    if (auth.mode !== 'restreinte') throw new ErreurHttp(403, 'Changement non autorisé.');
    const compte = await this.verifierSession(auth);
    const hache = await this.mots.hacher(motDePasse);
    if (
      auth.expire_le <= Date.now() ||
      !compte.mdp_temporaire_hache ||
      !compte.mdp_temporaire_expire_le ||
      !(await this.comptes.changerMotDePasse(
        compte.id_utilisateur,
        compte.mdp_temporaire_hache,
        compte.mdp_temporaire_expire_le,
        hache,
      ))
    ) {
      throw new ErreurHttp(401, 'Session invalide.');
    }
    return {
      id_utilisateur: compte.id_utilisateur,
      mode: 'normale',
      preuve: preuveSession(hache),
      expire_le: Date.now() + 8 * 60 * 60000,
    };
  }
}

/** Projection explicite : jamais de mot de passe, d'empreinte ni de statut interne dans le JSON. */
export function utilisateurPublic(compte: Utilisateur) {
  return {
    id_utilisateur: compte.id_utilisateur,
    email_connexion: compte.email_connexion,
    nom_utilisateur: compte.nom_utilisateur,
    prenom: compte.prenom,
    nom: compte.nom,
    role: compte.role,
  };
}
