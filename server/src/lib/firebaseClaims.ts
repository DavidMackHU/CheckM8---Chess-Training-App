// Kept apart from firebase.ts so unit tests can load it (Jest cannot load the jose library).
import type { JWTPayload } from 'jose'

export type FirebaseProfile = {
  uid: string
  email: string
  emailVerified: boolean
  name: string
  /** How they signed in, e.g. "password" or "google.com". */
  provider: string
}

/**
 * Checks the claims of a token whose signature is already verified. Returns
 * null unless it is a sign-in for this project with an email address.
 */
export function readClaims(payload: JWTPayload, projectId: string, nowSec = Date.now() / 1000): FirebaseProfile | null {
  const claims = payload as JWTPayload & Record<string, unknown>
  if (claims.iss !== `https://securetoken.google.com/${projectId}` || claims.aud !== projectId) return null
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) return null
  if (typeof claims.auth_time !== 'number' || claims.auth_time > nowSec + 300) return null
  if (typeof claims.email !== 'string' || !claims.email.includes('@')) return null
  const firebase = claims.firebase as { sign_in_provider?: unknown } | undefined
  return {
    uid: claims.sub,
    email: claims.email.trim().toLowerCase(),
    emailVerified: claims.email_verified === true,
    name: typeof claims.name === 'string' ? claims.name : '',
    provider: typeof firebase?.sign_in_provider === 'string' ? firebase.sign_in_provider : 'unknown',
  }
}
