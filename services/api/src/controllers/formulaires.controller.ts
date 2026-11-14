import type { Request, Response } from 'express';
import { email, invalide, objet, texte } from '../http/validation.js';
import { FormulairesRepository } from '../repositories/formulaires.repository.js';
import { FormulairesService } from '../services/formulaires.service.js';

/** Validation serveur independante de celle du navigateur. */
export class FormulairesController {
  constructor(
    private readonly service: FormulairesService,
    private readonly repository: FormulairesRepository,
  ) {}

  contacter = async (requete: Request, reponse: Response): Promise<void> => {
    const d = objet(requete.body, ['nom_utilisateur', 'email', 'titre', 'description']);
    const nom = texte(d, 'nom_utilisateur', 100, true);
    const adresse = texte(d, 'email', 255, true);
    if (!nom && !adresse) invalide();
    await this.service.contacter({
      nom_utilisateur: nom,
      email: adresse ? email(adresse) : '',
      titre: texte(d, 'titre', 150),
      description: texte(d, 'description', 5000),
    });
    reponse.status(200).json({ message: 'Votre message a bien été envoyé.' });
  };

  demander = async (requete: Request, reponse: Response): Promise<void> => {
    const d = objet(requete.body, [
      'entreprise',
      'nom',
      'prenom',
      'email',
      'telephone',
      'lieu_souhaite',
      'date_souhaitee',
      'id_type_evenement',
      'nb_participants',
      'description_besoin',
    ]);
    const date = texte(d, 'date_souhaitee', 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      invalide();
    const nombre = d['nb_participants'];
    const type = d['id_type_evenement'];
    if (
      typeof nombre !== 'number' ||
      !Number.isInteger(nombre) ||
      nombre < 1 ||
      nombre > 2147483647 ||
      typeof type !== 'number' ||
      !Number.isInteger(type) ||
      type < 1 ||
      type > 32767
    )
      invalide();
    const resultat = await this.service.demander({
      entreprise: texte(d, 'entreprise', 255),
      nom: texte(d, 'nom', 120),
      prenom: texte(d, 'prenom', 120),
      email: email(texte(d, 'email', 255)),
      telephone: texte(d, 'telephone', 35),
      lieu_souhaite: texte(d, 'lieu_souhaite', 2000),
      date_souhaitee: date,
      id_type_evenement: type as number,
      nb_participants: nombre as number,
      description_besoin: texte(d, 'description_besoin', 5000),
    });
    reponse.status(201).json(resultat);
  };

  types = async (_requete: Request, reponse: Response): Promise<void> => {
    reponse.json(await this.repository.typesEvenement());
  };
  remerciement = async (_requete: Request, reponse: Response): Promise<void> => {
    reponse.json({ texte_remerciement: await this.repository.remerciement() });
  };
  modifierRemerciement = async (requete: Request, reponse: Response): Promise<void> => {
    const d = objet(requete.body, ['texte_remerciement']);
    await this.repository.modifierRemerciement(texte(d, 'texte_remerciement', 2000));
    reponse.json({ message: 'Le message de remerciement a été enregistré.' });
  };
}
