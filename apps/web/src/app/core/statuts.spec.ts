import { TestBed } from '@angular/core/testing';
import { BadgeStatut } from './badge-statut';
import { LIBELLES } from './gestion.models';
import { FAMILLES_STATUT, LIBELLES_STATUT, familleStatut, libelleStatut } from './statuts';

/** Table « Familles visuelles des statuts » de la charte graphique CO-09. */
const CHARTE: Record<string, string[]> = {
  neutre: ['brouillon', 'en_preparation', 'a_faire'],
  information: ['a_contacter', 'etude_client', 'en_cours'],
  alerte: ['modification', 'en_attente', 'suspendu'],
  succes: ['accepte', 'valide', 'converti', 'termine', 'actif'],
  erreur: ['refuse', 'annule', 'echoue', 'supprime'],
};

describe('Statuts et badges', () => {
  it('reprend exactement la table des familles de la charte', () => {
    const attendu = Object.fromEntries(
      Object.entries(CHARTE).flatMap(([famille, statuts]) => statuts.map((s) => [s, famille])),
    );
    expect(FAMILLES_STATUT).toEqual(attendu);
  });

  it('donne un libelle a chaque statut de la table et garde les roles a part', () => {
    expect(Object.keys(LIBELLES_STATUT).sort()).toEqual(Object.keys(FAMILLES_STATUT).sort());
    for (const statut of Object.keys(FAMILLES_STATUT)) expect(LIBELLES[statut]).toBeTruthy();
    expect(LIBELLES['admin']).toBe('Administrateur');
    expect(familleStatut('admin')).toBe('neutre');
  });

  it.each([
    ['brouillon', 'statut-neutre', 'Brouillon'],
    ['a_contacter', 'statut-information', 'À contacter'],
    ['en_cours', 'statut-information', 'En cours'],
    ['modification', 'statut-alerte', 'Modification demandée'],
    ['accepte', 'statut-succes', 'Accepté'],
    ['termine', 'statut-succes', 'Terminé'],
    ['refuse', 'statut-erreur', 'Refusé'],
    ['annule', 'statut-erreur', 'Annulé'],
  ])('affiche %s en clair avec la classe %s', async (statut, classe, libelle) => {
    TestBed.configureTestingModule({ imports: [BadgeStatut] });
    const f = TestBed.createComponent(BadgeStatut);
    f.componentRef.setInput('statut', statut);
    f.detectChanges();
    const badge = f.nativeElement.querySelector('span') as HTMLSpanElement;
    expect(badge.classList.contains('statut')).toBe(true);
    expect(badge.classList.contains(classe)).toBe(true);
    expect(badge.textContent?.trim()).toBe(libelle);
  });

  it('distingue Brouillon et En cours', () => {
    expect(familleStatut('brouillon')).not.toBe(familleStatut('en_cours'));
  });

  it('affiche un statut inconnu tel quel, en neutre', () => {
    expect(libelleStatut('inconnu')).toBe('inconnu');
    expect(familleStatut('inconnu')).toBe('neutre');
  });
});
