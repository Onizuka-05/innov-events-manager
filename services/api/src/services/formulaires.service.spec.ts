import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurHttp } from '../http/erreur-http.js';
import type {
  DemandeDevis,
  FormulairesRepository,
} from '../repositories/formulaires.repository.js';
import type { Courriel, EnvoiCourriels } from './courriels.service.js';
import { FormulairesService } from './formulaires.service.js';

const demande: DemandeDevis = {
  entreprise: 'Société Essai',
  nom: 'Martin',
  prenom: 'Camille',
  email: 'camille@example.org',
  telephone: '0600000000',
  lieu_souhaite: 'Lyon',
  date_souhaitee: '2027-03-01',
  id_type_evenement: 2,
  nb_participants: 40,
  description_besoin: 'Séminaire d’une journée.',
};

/** Service isole : base et envoi d'e-mails simules, ordre des appels enregistre. */
function preparer(envoi: (c: Courriel) => Promise<void> = async () => undefined) {
  const ordre: string[] = [];
  const repository = {
    typesEvenement: vi.fn(async () => [
      { id_type_evenement: 1, libelle: 'Séminaire' },
      { id_type_evenement: 2, libelle: 'Conférence' },
    ]),
    creerProspect: vi.fn(async () => {
      ordre.push('enregistrement');
    }),
    remerciement: vi.fn(async () => 'Merci, nous vous recontactons.'),
  };
  const courriels = {
    envoyer: vi.fn(async (c: Courriel) => {
      ordre.push('notification');
      await envoi(c);
    }),
  };
  const service = new FormulairesService(
    repository as unknown as FormulairesRepository,
    courriels as EnvoiCourriels,
    'contact@example.org',
  );
  return { service, repository, courriels, ordre };
}

describe('Demande de devis (service, unitaire)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('enregistre la demande avant de notifier l’adresse de contact, puis renvoie le remerciement', async () => {
    const { service, repository, courriels, ordre } = preparer();
    expect(await service.demander(demande)).toEqual({
      texte_remerciement: 'Merci, nous vous recontactons.',
      notification_envoyee: true,
    });
    expect(repository.creerProspect).toHaveBeenCalledWith(demande);
    expect(ordre).toEqual(['enregistrement', 'notification']);
    const courriel = courriels.envoyer.mock.calls[0]![0];
    expect(courriel).toMatchObject({
      destinataire: 'contact@example.org',
      titre: 'Nouvelle demande de devis',
      repondreA: 'camille@example.org',
    });
    expect(courriel.texte).toContain('email : camille@example.org');
    expect(courriel.texte).toContain('nb_participants : 40');
  });

  it('refuse un type d’evenement indisponible sans rien enregistrer ni envoyer', async () => {
    const { service, repository, courriels } = preparer();
    const erreur = await service
      .demander({ ...demande, id_type_evenement: 99 })
      .catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurHttp);
    expect((erreur as ErreurHttp).statut).toBe(400);
    expect(repository.creerProspect).not.toHaveBeenCalled();
    expect(courriels.envoyer).not.toHaveBeenCalled();
  });

  it('conserve la demande si l’e-mail echoue et le signale sans donnee personnelle', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { service, repository } = preparer(async () => {
      throw new Error('service d’e-mail indisponible');
    });
    expect(await service.demander(demande)).toEqual({
      texte_remerciement: 'Merci, nous vous recontactons.',
      notification_envoyee: false,
    });
    expect(repository.creerProspect).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith(
      JSON.stringify({ evenement: 'notification_devis_indisponible' }),
    );
    expect(String(info.mock.calls)).not.toContain('camille@example.org');
  });
});
