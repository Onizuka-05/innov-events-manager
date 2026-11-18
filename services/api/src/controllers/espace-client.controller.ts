import type { Request, Response } from 'express';
import { ErreurHttp } from '../http/erreur-http.js';
import { email, invalide, objet, texte } from '../http/validation.js';
import type { CompteProfil, FicheProfil } from '../repositories/espace-client.repository.js';
import type { Utilisateur } from '../repositories/utilisateurs.repository.js';
import { EspaceClientService } from '../services/espace-client.service.js';

const identifiant = (v: unknown): string => {
  if (typeof v !== 'string' || !/^[1-9][0-9]{0,17}$/u.test(v)) invalide();
  return v as string;
};
/** Mot de passe saisi pour confirmer : jamais transforme, borne comme a la connexion. */
const motSaisi = (v: unknown): string => {
  if (typeof v !== 'string' || !v || v.length > 256) invalide();
  return v as string;
};

/** Memes validations que la gestion des comptes et des clients par l'administratrice. */
function lireCompte(valeur: unknown): CompteProfil {
  const d = objet(valeur, ['prenom', 'nom', 'nom_utilisateur', 'email_connexion']);
  return {
    prenom: texte(d, 'prenom', 120),
    nom: texte(d, 'nom', 120),
    nom_utilisateur: texte(d, 'nom_utilisateur', 100),
    email_connexion: email(texte(d, 'email_connexion', 255)),
  };
}
function lireFiche(valeur: unknown): FicheProfil {
  const d = objet(valeur, [
    'entreprise',
    'prenom_contact',
    'nom_contact',
    'email_contact',
    'telephone',
    'adresse_postale',
  ]);
  return {
    entreprise: texte(d, 'entreprise', 255),
    prenom_contact: texte(d, 'prenom_contact', 120),
    nom_contact: texte(d, 'nom_contact', 120),
    email_contact: email(texte(d, 'email_contact', 255)),
    telephone: texte(d, 'telephone', 35),
    adresse_postale: texte(d, 'adresse_postale', 2000),
  };
}

/** Espace du client connecte ; l'identifiant vient toujours de la session verifiee. */
export class EspaceClientController {
  constructor(private readonly service: EspaceClientService) {}
  private compte(s: Response): string {
    return s.locals['utilisateur'].id_utilisateur;
  }
  /** Hache du mot de passe qui a autorise la session (route reservee aux sessions normales). */
  private hacheSession(s: Response): string {
    const hache = (s.locals['utilisateur'] as Utilisateur).mot_de_passe_hache;
    if (!hache) throw new ErreurHttp(401, 'Session invalide.');
    return hache;
  }
  accueil = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.accueil(this.compte(s), this.hacheSession(s)));
  };
  profil = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.profil(this.compte(s), undefined, this.hacheSession(s)));
  };
  modifierProfil = async (r: Request, s: Response) => {
    const d = objet(r.body, ['compte', 'fiche', 'mot_de_passe_actuel']);
    if (d['compte'] === undefined && d['fiche'] === undefined) invalide();
    const mot = d['mot_de_passe_actuel'];
    s.json(
      await this.service.modifierProfil(
        this.compte(s),
        this.hacheSession(s),
        d['compte'] === undefined ? null : lireCompte(d['compte']),
        d['fiche'] === undefined ? null : lireFiche(d['fiche']),
        mot === undefined || mot === '' ? null : motSaisi(mot),
      ),
    );
  };
  /** Apres l'effacement, la session courante est detruite et le cookie efface. */
  supprimerProfil = async (r: Request, s: Response) => {
    const d = objet(r.body, ['mot_de_passe']);
    await this.service.effacer(this.compte(s), this.hacheSession(s), motSaisi(d['mot_de_passe']));
    await new Promise<void>((resolve, reject) =>
      r.session.destroy((erreur) => (erreur ? reject(erreur) : resolve())),
    );
    s.clearCookie('innov.sid', { path: '/' });
    s.json({ message: 'Votre compte a été supprimé.' });
  };
  evenements = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.evenements(this.compte(s), this.hacheSession(s)));
  };
  creerAvis = async (r: Request, s: Response) => {
    const d = objet(r.body, ['note_evaluation', 'commentaire']);
    const note = d['note_evaluation'];
    if (typeof note !== 'number' || !Number.isInteger(note) || note < 1 || note > 5) invalide();
    const commentaire = texte(d, 'commentaire', 10000);
    if (commentaire.length > 2000) invalide();
    s.status(201).json(
      await this.service.repository.creerAvis(
        identifiant(r.params['id']),
        this.compte(s),
        this.hacheSession(s),
        note as number,
        commentaire,
      ),
    );
  };
  donnerAccord = async (r: Request, s: Response) => {
    s.json(
      await this.service.repository.accordPublication(
        identifiant(r.params['id']),
        this.compte(s),
        this.hacheSession(s),
        true,
      ),
    );
  };
  retirerAccord = async (r: Request, s: Response) => {
    s.json(
      await this.service.repository.accordPublication(
        identifiant(r.params['id']),
        this.compte(s),
        this.hacheSession(s),
        false,
      ),
    );
  };
}
