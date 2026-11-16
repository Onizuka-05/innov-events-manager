import type { Request, Response } from 'express';
import { objet, texte, email, invalide } from '../http/validation.js';
import { GestionService, verifierStatutTache } from '../services/gestion.service.js';

const identifiant = (v: unknown): string => {
  if (typeof v !== 'string' || !/^[1-9][0-9]{0,17}$/u.test(v)) invalide();
  return v as string;
};
const optionId = (v: unknown): string | null => (v == null || v === '' ? null : identifiant(v));
const entier = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 32767) invalide();
  return v as number;
};
const date = (d: Record<string, unknown>, k: string): string => {
  const v = texte(d, k, 40);
  if (!Number.isFinite(Date.parse(v))) invalide();
  return v;
};
/** Entrees bornees et projections des espaces administrateur et employe. */
export class GestionController {
  constructor(private readonly service: GestionService) {}
  private id(r: Request) {
    return identifiant(r.params['id']);
  }
  private acteur(s: Response): string {
    return s.locals['utilisateur'].id_utilisateur;
  }
  private admin(s: Response): boolean {
    return s.locals['utilisateur'].role === 'admin';
  }
  tableau = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.tableauDeBord());
  };
  clients = async (r: Request, s: Response) => {
    const recherche = r.query['recherche'] ?? '';
    if (typeof recherche !== 'string' || recherche.length > 200) invalide();
    s.json(await this.service.repository.clients(recherche as string));
  };
  client = async (r: Request, s: Response) => {
    s.json(await this.service.repository.client(this.id(r)));
  };
  enregistrerClient = async (r: Request, s: Response) => {
    const d = objet(r.body, [
      'entreprise',
      'nom_contact',
      'prenom_contact',
      'email_contact',
      'telephone',
      'adresse_postale',
    ]);
    const resultat = await this.service.enregistrerClient(
      {
        entreprise: texte(d, 'entreprise', 255),
        nom_contact: texte(d, 'nom_contact', 120),
        prenom_contact: texte(d, 'prenom_contact', 120),
        email_contact: email(texte(d, 'email_contact', 255)),
        telephone: texte(d, 'telephone', 35),
        adresse_postale: texte(d, 'adresse_postale', 2000),
      },
      this.acteur(s),
      r.params['id'] ? this.id(r) : undefined,
    );
    s.status(r.params['id'] ? 200 : 201).json(resultat);
  };
  supprimerClient = async (r: Request, s: Response) => {
    await this.service.supprimerClient(this.id(r), this.acteur(s));
    s.json({ message: 'Client supprimé et fiche anonymisée.' });
  };
  evenements = async (r: Request, s: Response) => {
    if (r.query['avenir'] !== undefined && r.query['avenir'] !== 'true') invalide();
    s.json(await this.service.repository.evenements(r.query['avenir'] === 'true'));
  };
  evenement = async (r: Request, s: Response) => {
    s.json(await this.service.repository.evenement(this.id(r)));
  };
  modifierEvenement = async (r: Request, s: Response) => {
    const d = objet(r.body, [
      'nom',
      'id_type_evenement',
      'id_theme',
      'date_debut',
      'date_fin',
      'lieu',
      'statut_evenement',
      'image_url',
      'visible_public',
    ]);
    const debut = date(d, 'date_debut'),
      fin = date(d, 'date_fin');
    if (Date.parse(fin) <= Date.parse(debut)) invalide();
    const statut = texte(d, 'statut_evenement', 20);
    if (!['brouillon', 'accepte', 'en_cours', 'termine', 'annule'].includes(statut)) invalide();
    let image: string | null = null;
    if (d['image_url'] != null && d['image_url'] !== '') {
      image = texte(d, 'image_url', 2000);
      try {
        if (new URL(image).protocol !== 'https:') invalide();
      } catch {
        invalide();
      }
    }
    if (typeof d['visible_public'] !== 'boolean') invalide();
    await this.service.modifierEvenement(
      this.id(r),
      {
        nom: texte(d, 'nom', 255),
        id_type_evenement: entier(d['id_type_evenement']),
        id_theme: d['id_theme'] == null ? null : entier(d['id_theme']),
        date_debut: debut,
        date_fin: fin,
        lieu: texte(d, 'lieu', 2000),
        statut_evenement: statut,
        image_url: image,
        visible_public: d['visible_public'] as boolean,
      },
      this.acteur(s),
    );
    s.json({ message: 'Événement modifié.' });
  };
  supprimerEvenement = async (r: Request, s: Response) => {
    await this.service.repository.supprimerEvenement(this.id(r));
    s.json({ message: 'Événement supprimé.' });
  };
  notesGlobales = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.notes(null));
  };
  creerNote = async (r: Request, s: Response) => {
    const d = objet(r.body, ['id_evenement', 'contenu']);
    s.status(201).json(
      await this.service.repository.enregistrerNote(
        null,
        optionId(d['id_evenement']),
        texte(d, 'contenu', 5000),
        this.acteur(s),
        this.admin(s),
      ),
    );
  };
  modifierNote = async (r: Request, s: Response) => {
    const d = objet(r.body, ['contenu']);
    s.json(
      await this.service.repository.enregistrerNote(
        this.id(r),
        null,
        texte(d, 'contenu', 5000),
        this.acteur(s),
        this.admin(s),
      ),
    );
  };
  supprimerNote = async (r: Request, s: Response) => {
    await this.service.repository.enregistrerNote(
      this.id(r),
      null,
      '',
      this.acteur(s),
      this.admin(s),
      true,
    );
    s.json({ message: 'Note supprimée.' });
  };
  creerTache = async (r: Request, s: Response) => {
    const d = objet(r.body, [
      'id_evenement',
      'id_utilisateur',
      'titre',
      'description',
      'date_echeance',
    ]);
    s.status(201).json(
      await this.service.repository.creerTache({
        id_evenement: identifiant(d['id_evenement']),
        id_utilisateur: identifiant(d['id_utilisateur']),
        titre: texte(d, 'titre', 255),
        description: texte(d, 'description', 3000, true) || null,
        date_echeance: d['date_echeance'] ? date(d, 'date_echeance') : null,
      }),
    );
  };
  affecterTache = async (r: Request, s: Response) => {
    const d = objet(r.body, ['id_utilisateur']);
    await this.service.repository.affecterTache(this.id(r), identifiant(d['id_utilisateur']));
    s.json({ message: 'Tâche affectée.' });
  };
  statutTache = async (r: Request, s: Response) => {
    const d = objet(r.body, ['statut_tache']);
    await this.service.repository.statutTache(
      this.id(r),
      this.acteur(s),
      texte(d, 'statut_tache', 20),
      verifierStatutTache,
    );
    s.json({ message: 'Statut enregistré.' });
  };
  comptes = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.comptes());
  };
  creerCompte = async (r: Request, s: Response) => {
    const d = objet(r.body, [
      'email_connexion',
      'nom_utilisateur',
      'prenom',
      'nom',
      'role',
      'id_client',
    ]);
    if (!['client', 'employe'].includes(String(d['role']))) invalide();
    const idClient = optionId(d['id_client']);
    if (idClient && d['role'] !== 'client') invalide();
    s.status(201).json(
      await this.service.creerCompte({
        email_connexion: email(texte(d, 'email_connexion', 255)),
        nom_utilisateur: texte(d, 'nom_utilisateur', 100),
        prenom: texte(d, 'prenom', 120),
        nom: texte(d, 'nom', 120),
        role: d['role'] as 'client' | 'employe',
        id_client: idClient,
      }),
    );
  };
  statutCompte = async (r: Request, s: Response) => {
    const d = objet(r.body, ['statut_compte']);
    const statut = texte(d, 'statut_compte', 20);
    if (!['actif', 'suspendu'].includes(statut)) invalide();
    await this.service.repository.statutCompte(this.id(r), statut);
    s.json({ message: 'Statut enregistré.' });
  };
  supprimerCompte = async (r: Request, s: Response) => {
    await this.service.supprimerCompte(this.id(r), this.acteur(s));
    s.json({ message: 'Compte supprimé.' });
  };
  avis = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.avis());
  };
  avisPublics = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.avis(true));
  };
  moderer = async (r: Request, s: Response) => {
    const d = objet(r.body, ['statut_avis']);
    const statut = texte(d, 'statut_avis', 20);
    if (!['valide', 'refuse'].includes(statut)) invalide();
    await this.service.repository.moderer(this.id(r), statut);
    s.json({ message: 'Avis modéré.' });
  };
  journaux = async (r: Request, s: Response) => {
    if (Object.keys(r.query).some((k) => !['type_action', 'page'].includes(k))) invalide();
    const type = r.query['type_action'] ?? '';
    const page = r.query['page'] ?? '1';
    if (
      typeof type !== 'string' ||
      !/^[A-Z_]{0,80}$/u.test(type) ||
      typeof page !== 'string' ||
      !/^[1-9][0-9]{0,3}$/u.test(page)
    )
      invalide();
    s.json(await this.service.journaux(type as string, Number(page)));
  };
}
