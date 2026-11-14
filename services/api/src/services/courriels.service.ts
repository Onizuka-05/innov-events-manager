import nodemailer from 'nodemailer';
import type { Configuration } from '../config/config.js';
import { ErreurHttp } from '../http/erreur-http.js';

export interface Courriel {
  destinataire: string;
  titre: string;
  texte: string;
  repondreA?: string;
}
export interface EnvoiCourriels {
  envoyer(courriel: Courriel): Promise<void>;
}

/** Mailpit par SMTP local, Brevo par HTTPS en production. */
export class CourrielsService implements EnvoiCourriels {
  constructor(private readonly configuration: Configuration) {}

  /** Le texte brut evite l'injection de contenu HTML dans les messages. */
  async envoyer(courriel: Courriel): Promise<void> {
    const config = this.configuration;
    try {
      if (config.production) {
        const resultat = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: { 'api-key': config.brevoApiKey ?? '', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { email: config.mailExpediteur },
            to: [{ email: courriel.destinataire }],
            subject: courriel.titre,
            textContent: courriel.texte,
            ...(courriel.repondreA ? { replyTo: { email: courriel.repondreA } } : {}),
          }),
        });
        if (!resultat.ok) throw new Error('Envoi refuse');
      } else {
        const transport = nodemailer.createTransport({
          host: config.smtpHost ?? 'localhost',
          port: config.smtpPort ?? 1025,
          secure: false,
          ignoreTLS: true,
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 10000,
        });
        await transport.sendMail({
          from: config.mailExpediteur ?? 'ne-pas-repondre@innov-events.invalid',
          to: courriel.destinataire,
          subject: courriel.titre,
          text: courriel.texte,
          replyTo: courriel.repondreA,
        });
      }
    } catch {
      throw new ErreurHttp(503, 'L’envoi du message est momentanément indisponible.');
    }
  }
}
