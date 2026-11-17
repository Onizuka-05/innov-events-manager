import { FAMILLES_STATUT, LIBELLES_STATUT, familleStatut, libelleStatut } from './statuts';

/** Table « Familles visuelles des statuts » de la charte graphique CO-09. */
const CHARTE: Record<string, string[]> = {
  neutre: ['brouillon', 'en_preparation', 'a_faire'],
  information: ['a_contacter', 'etude_client', 'en_cours'],
  alerte: ['modification', 'en_attente', 'suspendu'],
  succes: ['accepte', 'valide', 'converti', 'termine', 'actif'],
  erreur: ['refuse', 'annule', 'echoue', 'supprime'],
};

describe('Statuts mobiles', () => {
  it('reprend exactement la table des familles de la charte', () => {
    const attendu = Object.fromEntries(
      Object.entries(CHARTE).flatMap(([famille, statuts]) => statuts.map((s) => [s, famille])),
    );
    expect(FAMILLES_STATUT).toEqual(attendu);
    expect(Object.keys(LIBELLES_STATUT).sort()).toEqual(Object.keys(FAMILLES_STATUT).sort());
  });
  it('affiche un statut inconnu tel quel, en neutre', () => {
    expect(libelleStatut('inconnu')).toBe('inconnu');
    expect(familleStatut('inconnu')).toBe('neutre');
  });
});
