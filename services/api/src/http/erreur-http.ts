/** Erreur metier avec un message public choisi par l'application. */
export class ErreurHttp extends Error {
  constructor(
    public readonly statut: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}
