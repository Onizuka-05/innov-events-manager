import type { Request, Response } from 'express';
import { ErreurHttp } from '../http/erreur-http.js';
import { objet, texte, invalide } from '../http/validation.js';
import { DevisService } from '../services/devis.service.js';

type Choix = 'accepte' | 'refuse' | 'modification';
const identifiant = (v: unknown): string => {
  if (typeof v !== 'string' || !/^[1-9][0-9]*$/u.test(v)) invalide();
  return v as string;
};
const positif = (v: unknown, max = 32767): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) invalide();
  return v as number;
};
const optionNombre = (v: unknown): number | null =>
  v === null || v === undefined ? null : positif(v);
/** Controleur HTTP : aucune valeur utilisateur ne devient une requete SQL. */
export class DevisController {
  constructor(private readonly service: DevisService) {}
  private acteur(r: Request): string {
    return String(r.session.authentification!.id_utilisateur);
  }
  /** Hache du mot de passe qui a autorise la session (routes reservees aux sessions normales). */
  private hacheSession(s: Response): string {
    const hache = (s.locals['utilisateur'] as { mot_de_passe_hache: string | null })
      .mot_de_passe_hache;
    if (!hache) throw new ErreurHttp(401, 'Session invalide.');
    return hache;
  }
  private role(r: Request): string {
    return String(r.res!.locals['utilisateur'].role);
  }
  prospects = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.prospects());
  };
  clients = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.clients());
  };
  evenements = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.evenements());
  };
  themes = async (_r: Request, s: Response) => {
    s.json(await this.service.repository.themes());
  };
  echouer = async (r: Request, s: Response) => {
    const d = objet(r.body, ['message']);
    await this.service.echouer(
      identifiant(r.params['id']),
      texte(d, 'message', 3000),
      this.acteur(r),
    );
    s.json({ message: 'Demande classée sans suite.' });
  };
  convertir = async (r: Request, s: Response) => {
    const d = objet(r.body, ['adresse_postale', 'id_client_confirme']);
    const confirme = d['id_client_confirme'];
    const resultat = await this.service.repository.convertir(
      identifiant(r.params['id']),
      texte(d, 'adresse_postale', 2000),
      confirme === undefined || confirme === null ? null : identifiant(confirme),
    );
    if (resultat.cree)
      await this.service.journal('CREATION_CLIENT', this.acteur(r), {
        id_client: resultat.id_client,
        nom_client: resultat.nom_client,
      });
    s.status(resultat.cree ? 201 : 200).json(resultat);
  };
  creerEvenement = async (r: Request, s: Response) => {
    const d = objet(r.body, [
      'id_client',
      'id_prospect',
      'id_type_evenement',
      'id_theme',
      'nom',
      'date_debut',
      'date_fin',
      'lieu',
      'statut_evenement',
      'image_url',
      'visible_public',
    ]);
    const statut = d['statut_evenement'] ?? 'brouillon';
    if (statut !== 'brouillon' && statut !== 'accepte') invalide();
    const image = d['image_url'];
    if (
      image !== undefined &&
      image !== null &&
      (typeof image !== 'string' || image.length > 2000 || !/^https:\/\/[^\s]+$/u.test(image))
    )
      invalide();
    const dates = ['date_debut', 'date_fin'].map((k) => texte(d, k, 40));
    if (
      dates.some((v) => !Number.isFinite(Date.parse(v))) ||
      Date.parse(dates[1]!) <= Date.parse(dates[0]!)
    )
      invalide();
    s.status(201).json(
      await this.service.creerEvenement(
        {
          id_client: identifiant(d['id_client']),
          id_prospect: d['id_prospect'] ? identifiant(d['id_prospect']) : null,
          id_type_evenement: positif(d['id_type_evenement']),
          id_theme: optionNombre(d['id_theme']),
          nom: texte(d, 'nom', 255),
          date_debut: dates[0]!,
          date_fin: dates[1]!,
          lieu: texte(d, 'lieu', 2000),
          statut_evenement: statut as 'brouillon' | 'accepte',
          image_url: typeof image === 'string' ? image : null,
          visible_public: d['visible_public'] === true,
        },
        this.acteur(r),
      ),
    );
  };
  creer = async (r: Request, s: Response) => {
    const d = objet(r.body, ['id_evenement', 'intitule']);
    s.status(201).json(
      await this.service.creerDevis(identifiant(d['id_evenement']), texte(d, 'intitule', 255)),
    );
  };
  liste = async (r: Request, s: Response) => {
    const client = this.role(r) === 'client';
    s.json(
      await this.service.repository.liste(
        this.acteur(r),
        this.role(r),
        client ? this.hacheSession(s) : null,
      ),
    );
  };
  detail = async (r: Request, s: Response) => {
    const client = this.role(r) === 'client';
    s.json(
      await this.service.consulter(
        identifiant(r.params['id']),
        this.acteur(r),
        this.role(r),
        client ? this.hacheSession(s) : null,
      ),
    );
  };
  intitule = async (r: Request, s: Response) => {
    const d = objet(r.body, ['intitule']);
    await this.service.repository.modifierDevis(
      identifiant(r.params['id']),
      texte(d, 'intitule', 255),
    );
    s.json({ message: 'Devis modifié.' });
  };
  lignes = async (r: Request, s: Response) => {
    const d = objet(r.body, ['lignes']);
    const lignes = d['lignes'];
    if (!Array.isArray(lignes) || lignes.length > 100) invalide();
    const valides = (lignes as unknown[]).map((l) => {
      const v = objet(l, ['libelle_prestation', 'montant_ht']);
      const montant = v['montant_ht'];
      if (
        typeof montant !== 'number' ||
        !Number.isFinite(montant) ||
        montant < 0 ||
        montant > 9999999999.99 ||
        Math.abs(montant * 100 - Math.round(montant * 100)) > 1e-6
      )
        invalide();
      return {
        libelle_prestation: texte(v, 'libelle_prestation', 2000),
        montant_ht: montant as number,
      };
    });
    await this.service.remplacerLignes(identifiant(r.params['id']), valides);
    s.json({ message: 'Prestations enregistrées.' });
  };
  pdf = async (r: Request, s: Response) => {
    const id = identifiant(r.params['id']);
    if (
      this.role(r) === 'client' &&
      !(await this.service.repository.possede(id, this.acteur(r), this.hacheSession(s)))
    )
      throw new ErreurHttp(404, 'Devis introuvable.');
    const fichier = await this.service.genererPdf(id, this.acteur(r));
    s.setHeader('Content-Type', 'application/pdf');
    s.setHeader('Content-Disposition', `attachment; filename="devis-${id}.pdf"`);
    s.send(fichier);
  };
  envoyer = async (r: Request, s: Response) => {
    await this.service.envoyer(identifiant(r.params['id']), this.acteur(r));
    s.json({ message: 'Devis envoyé.' });
  };
  repondre = async (r: Request, s: Response) => {
    const d = objet(r.body, ['choix', 'motif_modification']);
    const choix = d['choix'];
    if (choix !== 'accepte' && choix !== 'refuse' && choix !== 'modification') invalide();
    const motif = choix === 'modification' ? texte(d, 'motif_modification', 3000) : '';
    await this.service.repondre(
      identifiant(r.params['id']),
      this.acteur(r),
      this.hacheSession(s),
      choix as Choix,
      motif,
    );
    s.json({ message: 'Réponse enregistrée.' });
  };
}
