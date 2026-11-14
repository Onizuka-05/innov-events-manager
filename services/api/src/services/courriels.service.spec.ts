import { afterEach, describe, expect, it, vi } from 'vitest';
import { CourrielsService } from './courriels.service.js';
import type { Configuration } from '../config/config.js';

const configuration = {
  production: true,
  brevoApiKey: 'cle-de-test',
  mailExpediteur: 'expediteur@example.org',
} as Configuration;

describe('Envoi Brevo par HTTPS', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('construit un message texte avec l’expediteur configure et le bon destinataire', async () => {
    const envoyer = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', envoyer);
    await new CourrielsService(configuration).envoyer({
      destinataire: 'contact@example.org',
      titre: 'Question',
      texte: 'Bonjour <script>',
      repondreA: 'client@example.org',
    });
    expect(envoyer).toHaveBeenCalledOnce();
    const [url, options] = envoyer.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(JSON.parse(options.body as string)).toEqual({
      sender: { email: 'expediteur@example.org' },
      to: [{ email: 'contact@example.org' }],
      subject: 'Question',
      textContent: 'Bonjour <script>',
      replyTo: { email: 'client@example.org' },
    });
    expect(options.headers).toEqual({
      'api-key': 'cle-de-test',
      'Content-Type': 'application/json',
    });
  });
  it('ne transmet aucun detail d’erreur du fournisseur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('secret-fournisseur', { status: 401 })),
    );
    await expect(
      new CourrielsService(configuration).envoyer({
        destinataire: 'test@example.org',
        titre: 'Test',
        texte: 'Test',
      }),
    ).rejects.toMatchObject({
      statut: 503,
      message: 'L’envoi du message est momentanément indisponible.',
    });
  });
});
