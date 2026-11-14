import type { Request, Response } from 'express';
import { ErreurHttp } from '../http/erreur-http.js';
import { email, invalide, motDePasse, objet, texte } from '../http/validation.js';
import type { Utilisateur } from '../repositories/utilisateurs.repository.js';
import {
  AuthentificationService,
  type AuthSession,
  utilisateurPublic,
} from '../services/authentification.service.js';

/** Regenere l'identifiant et le secret CSRF a chaque changement de privilege. */
async function ouvrirSession(requete: Request, auth: AuthSession): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    requete.session.regenerate((erreur) => (erreur ? reject(erreur) : resolve())),
  );
  requete.session.authentification = auth;
  requete.session.cookie.maxAge = Math.max(0, auth.expire_le - Date.now());
  await new Promise<void>((resolve, reject) =>
    requete.session.save((erreur) => (erreur ? reject(erreur) : resolve())),
  );
}

/** Traduit les entrees HTTP vers le service d'authentification. */
export class AuthentificationController {
  constructor(private readonly service: AuthentificationService) {}

  inscrire = async (requete: Request, reponse: Response): Promise<void> => {
    const d = objet(requete.body, [
      'email_connexion',
      'nom_utilisateur',
      'prenom',
      'nom',
      'mot_de_passe',
    ]);
    const donnees = {
      email_connexion: email(texte(d, 'email_connexion', 255)),
      nom_utilisateur: texte(d, 'nom_utilisateur', 100),
      prenom: texte(d, 'prenom', 120),
      nom: texte(d, 'nom', 120),
    };
    await this.service.inscrire(donnees, motDePasse(d['mot_de_passe']));
    reponse.status(202).json({
      message:
        'Si ces coordonnées sont disponibles, votre compte est créé et un e-mail de confirmation vous est envoyé.',
    });
  };

  connecter = async (requete: Request, reponse: Response): Promise<void> => {
    const d = objet(requete.body, ['email_connexion', 'mot_de_passe']);
    const adresse = email(texte(d, 'email_connexion', 255));
    const mot = d['mot_de_passe'];
    if (typeof mot !== 'string' || !mot || mot.length > 256) invalide();
    const { auth, utilisateur } = await this.service.connecter(
      adresse,
      mot as string,
      reponse.locals['ipClient'] as string,
    );
    await ouvrirSession(requete, auth);
    reponse
      .status(200)
      .json(
        auth.mode === 'restreinte'
          ? { changement_mdp_requis: true }
          : { utilisateur: utilisateurPublic(utilisateur), changement_mdp_requis: false },
      );
  };

  oublier = async (requete: Request, reponse: Response): Promise<void> => {
    const d = objet(requete.body, ['email_connexion']);
    await this.service.oublier(email(texte(d, 'email_connexion', 255)));
    reponse.status(202).json({
      message:
        'Si un compte actif correspond à cet e-mail, un mot de passe temporaire vous est envoyé.',
    });
  };

  changer = async (requete: Request, reponse: Response): Promise<void> => {
    const d = objet(requete.body, ['mot_de_passe']);
    const auth = requete.session.authentification;
    if (!auth) throw new ErreurHttp(401, 'Connexion requise.');
    await ouvrirSession(requete, await this.service.changer(auth, motDePasse(d['mot_de_passe'])));
    reponse.status(200).json({ message: 'Votre mot de passe a été enregistré.' });
  };

  courante = (_requete: Request, reponse: Response): void => {
    reponse.json({ utilisateur: utilisateurPublic(reponse.locals['utilisateur'] as Utilisateur) });
  };

  deconnecter = async (requete: Request, reponse: Response): Promise<void> => {
    await new Promise<void>((resolve, reject) =>
      requete.session.destroy((erreur) => (erreur ? reject(erreur) : resolve())),
    );
    reponse.clearCookie('innov.sid', { path: '/' });
    reponse.status(204).end();
  };
}
