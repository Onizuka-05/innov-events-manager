import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';

/** Hachage Argon2id, comparaison et generation de mots de passe temporaires. */
export class MotsDePasseService {
  /** Ne stocke jamais le mot de passe en clair. */
  hacher(valeur: string): Promise<string> {
    return argon2.hash(valeur, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  /** Un hache absent ou inutilisable ne valide jamais un mot de passe. */
  async verifier(hache: string | null, valeur: string): Promise<boolean> {
    if (!hache) return false;
    try {
      return await argon2.verify(hache, valeur);
    } catch {
      return false;
    }
  }

  /** Aleatoire cryptographique ; respecte aussi la regle de complexite. */
  genererTemporaire(): string {
    return `Aa1!${randomBytes(24).toString('base64url')}`;
  }
}

/** Empreinte interne pour invalider une session quand son mot de passe change. */
export function preuveSession(hache: string, consommation = ''): string {
  return createHash('sha256').update(hache).update('\0').update(consommation).digest('hex');
}
