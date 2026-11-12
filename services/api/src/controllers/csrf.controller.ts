import type { Request, Response } from 'express';

/** Fournit au front le jeton CSRF lie a la session en cours. */
export class CsrfController {
  fournirJeton = (requete: Request, reponse: Response): void => {
    reponse.setHeader('Cache-Control', 'no-store');
    reponse.json({ jeton_csrf: requete.csrfToken() });
  };
}
