// Verifies the ID tokens that Firebase Authentication gives the browser after
// a sign-in. Only the project id is needed: Google publishes the signing keys.
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { type FirebaseProfile, readClaims } from './firebaseClaims.js'

export type { FirebaseProfile }

const GOOGLE_KEYS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

/** Firebase project id, or null when Firebase sign-in is not set up. */
export function firebaseProjectId(): string | null {
  return process.env.FIREBASE_PROJECT_ID || null
}

// Tests can stand in for Google's keys (see e2e/fake-auth.mjs). Never honoured in production.
function keysUrl(): string {
  if (process.env.NODE_ENV === 'production') return GOOGLE_KEYS_URL
  return process.env.FIREBASE_JWKS_URL || GOOGLE_KEYS_URL
}

let keys: { url: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null
function keySet() {
  const url = keysUrl()
  if (!keys || keys.url !== url) keys = { url, set: createRemoteJWKSet(new URL(url)) }
  return keys.set
}

/** Verifies a Firebase ID token's signature, issuer, audience and expiry. Null if any check fails. */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseProfile | null> {
  const projectId = firebaseProjectId()
  if (!projectId || typeof idToken !== 'string' || idToken.length > 4096) return null
  try {
    const { payload } = await jwtVerify(idToken, keySet(), {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })
    return readClaims(payload, projectId)
  } catch {
    return null
  }
}
