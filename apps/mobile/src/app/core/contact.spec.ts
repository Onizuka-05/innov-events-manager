import { lienCourriel, lienItineraire, lienTelephone } from './contact';

describe('Liens de contact', () => {
  it.each([
    ['06 12 34 56 78', 'tel:0612345678'],
    ['06.12.34.56.78', 'tel:0612345678'],
    ['+33 6 12-34-56-78', 'tel:+33612345678'],
    ['', null],
    [null, null],
    ['. .', null],
  ])('nettoie le numero %s', (numero, attendu) => {
    expect(lienTelephone(numero)).toBe(attendu);
  });
  it('construit le lien d e-mail seulement pour une adresse', () => {
    expect(lienCourriel(' a@example.org ')).toBe('mailto:a@example.org');
    expect(lienCourriel('')).toBeNull();
    expect(lienCourriel(null)).toBeNull();
  });
  it('encode l adresse de l itineraire', () => {
    expect(lienItineraire('1 rue & co, Lyon', false)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=1%20rue%20%26%20co%2C%20Lyon',
    );
    expect(lienItineraire('1 rue & co, Lyon', true)).toBe(
      'https://maps.apple.com/?daddr=1%20rue%20%26%20co%2C%20Lyon',
    );
    expect(lienItineraire('  ', true)).toBeNull();
  });
});
