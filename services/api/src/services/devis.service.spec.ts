import { describe, expect, it, vi } from 'vitest';
import { DevisService } from './devis.service.js';
import type { DevisDetail, DevisRepository } from '../repositories/devis.repository.js';
import type { LogsService } from './logs.service.js';
import type { MotsDePasseService } from './mots-de-passe.service.js';
import type { DevisPdfService } from './devis-pdf.service.js';

const exemple: DevisDetail = {
  id_devis: '1',
  id_evenement: '2',
  intitule: 'Formule',
  statut_devis: 'en_preparation',
  taux_tva_applique: '20.00',
  date_envoi: null,
  motif_modification: null,
  id_client: '3',
  email_contact: 'test@example.invalid',
  nom_contact: 'Test',
  lignes: [
    {
      id_ligne_devis: '1',
      libelle_prestation: 'Accueil',
      montant_ht: '100.00',
      ordre_affichage: 1,
    },
    { id_ligne_devis: '2', libelle_prestation: 'Salle', montant_ht: '25.50', ordre_affichage: 2 },
  ],
};
function creerService() {
  const repo = {
    detail: vi.fn().mockResolvedValue(exemple),
    possede: vi.fn().mockResolvedValue(true),
    repondre: vi.fn().mockResolvedValue(false),
  };
  const logs = { action: vi.fn().mockResolvedValue(undefined) };
  const mail = { envoyer: vi.fn().mockResolvedValue(undefined) };
  const service = new DevisService(
    repo as unknown as DevisRepository,
    mail,
    {} as MotsDePasseService,
    logs as unknown as LogsService,
    'contact@example.invalid',
    {} as DevisPdfService,
  );
  return { service, repo, mail, logs };
}
describe('devis', () => {
  it('additionne les lignes HT', () => {
    expect(creerService().service.totaux(exemple).total_ht).toBe('125.50');
  });
  it('calcule la TVA', () => {
    expect(creerService().service.totaux(exemple).total_tva).toBe('25.10');
  });
  it('calcule le total TTC', () => {
    expect(creerService().service.totaux(exemple).total_ttc).toBe('150.60');
  });
  it('refuse de divulguer la fiche si le client ne la possede pas', async () => {
    const { service, repo } = creerService();
    repo.possede.mockResolvedValue(false);
    await expect(service.consulter('1', '4', 'client', 'hache')).rejects.toMatchObject({
      statut: 404,
    });
    expect(repo.detail).not.toHaveBeenCalled();
  });
  it('autorise la consultation administrateur', async () => {
    const { service, repo } = creerService();
    await expect(service.consulter('1', '4', 'admin', null)).resolves.toMatchObject({
      id_devis: '1',
    });
    expect(repo.possede).not.toHaveBeenCalled();
  });
  it('journalise une reponse de devis', async () => {
    const { service, repo, logs } = creerService();
    await service.repondre('1', '4', 'hache', 'refuse', '');
    expect(repo.repondre).toHaveBeenCalledWith('1', '4', 'hache', 'refuse', '');
    expect(logs.action).toHaveBeenCalledWith('REPONSE_DEVIS', '4', {
      id_devis: '1',
      statut_devis: 'refuse',
    });
  });
});
