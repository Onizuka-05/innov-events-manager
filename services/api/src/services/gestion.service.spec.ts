import { describe, it, expect } from 'vitest';
import { verifierStatutEvenement, verifierStatutTache } from './gestion.service.js';

describe('cycles des statuts', () => {
  it.each([
    ['brouillon', 'accepte'],
    ['brouillon', 'annule'],
    ['accepte', 'en_cours'],
    ['accepte', 'annule'],
    ['en_cours', 'termine'],
    ['en_cours', 'annule'],
  ])('autorise %s vers %s', (a, b) => expect(() => verifierStatutEvenement(a, b)).not.toThrow());
  it.each([
    ['termine', 'annule'],
    ['annule', 'accepte'],
    ['brouillon', 'termine'],
    ['accepte', 'brouillon'],
  ])('refuse %s vers %s', (a, b) => expect(() => verifierStatutEvenement(a, b)).toThrow());
  it.each([
    ['a_faire', 'en_cours'],
    ['en_cours', 'termine'],
  ])('avance une tache %s vers %s', (a, b) =>
    expect(() => verifierStatutTache(a, b)).not.toThrow(),
  );
  it.each([
    ['a_faire', 'termine'],
    ['termine', 'en_cours'],
    ['en_cours', 'a_faire'],
  ])('refuse de sauter ou reculer %s vers %s', (a, b) =>
    expect(() => verifierStatutTache(a, b)).toThrow(),
  );
});
