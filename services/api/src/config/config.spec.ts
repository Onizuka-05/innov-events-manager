import { describe, expect, it } from 'vitest';
import { chargerConfiguration } from './config.js';

const minimum = {
  SESSION_SECRET: 'un-secret-de-test-d-au-moins-32-caracteres',
  INTERNAL_PROXY_SECRET: 'secret-proxy-de-test-d-au-moins-32-caracteres',
  PGPASSWORD: 'test',
};

describe('chargerConfiguration', () => {
  it('ne fait confiance a aucun proxy par defaut', () => {
    expect(chargerConfiguration(minimum).trustProxyHops).toBe(0);
  });

  it('refuse un secret de session de moins de 32 caracteres', () => {
    expect(() => chargerConfiguration({ ...minimum, SESSION_SECRET: 'court' })).toThrow(
      'SESSION_SECRET',
    );
  });

  it('exige un secret proxy valide sans divulguer sa valeur', () => {
    expect(() => chargerConfiguration({ ...minimum, INTERNAL_PROXY_SECRET: '' })).toThrow(
      'INTERNAL_PROXY_SECRET',
    );
    expect(() => chargerConfiguration({ ...minimum, INTERNAL_PROXY_SECRET: 'court' })).toThrow();
    expect(() =>
      chargerConfiguration({ ...minimum, INTERNAL_PROXY_SECRET: 'x'.repeat(33) + '"' }),
    ).toThrow();
    expect(chargerConfiguration(minimum).secretProxyInterne).toBe(minimum.INTERNAL_PROXY_SECRET);
  });

  it('exige DATABASE_URL ou PGPASSWORD', () => {
    expect(() =>
      chargerConfiguration({
        SESSION_SECRET: minimum.SESSION_SECRET,
        INTERNAL_PROXY_SECRET: minimum.INTERNAL_PROXY_SECRET,
      }),
    ).toThrow('DATABASE_URL');
  });

  it('refuse une valeur numerique hors plage', () => {
    expect(() => chargerConfiguration({ ...minimum, TRUST_PROXY_HOPS: '9' })).toThrow();
    expect(() => chargerConfiguration({ ...minimum, PORT: 'abc' })).toThrow();
  });

  it('active le mode production uniquement si NODE_ENV vaut production', () => {
    expect(chargerConfiguration({ ...minimum, NODE_ENV: 'production' }).production).toBe(true);
    expect(chargerConfiguration({ ...minimum, NODE_ENV: 'development' }).production).toBe(false);
  });
});
