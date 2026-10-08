// "Sign in with Google" using the standard OAuth redirect flow.
// Needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and PUBLIC_URL. Without them the feature is off.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// Tests can stand in for Google (see e2e/fake-google.mjs). Never honoured in production.
const tokenUrl = () => (process.env.NODE_ENV === 'production' ? GOOGLE_TOKEN_URL : process.env.GOOGLE_TOKEN_URL || GOOGLE_TOKEN_URL)
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string; publicUrl: string }
export type GoogleProfile = { sub: string; email: string; name: string }

/** The site's own address, as visitors see it (the Vercel domain in production). */
export function publicUrl(): string {
  return (process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/+$/, '')
}

export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  const base = publicUrl()
  return { clientId, clientSecret, publicUrl: base, redirectUri: `${base}/api/auth/google/callback` }
}

/** Where to send the browser to start signing in. */
export function googleAuthUrl(config: GoogleConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `${AUTH_URL}?${params}`
}

/**
 * Reads the profile out of a Google ID token. The token must come straight
 * from Google's token endpoint over HTTPS (see exchangeCode), which is why the
 * signature is not checked here. Returns null unless it was issued by Google,
 * for this app, is not expired, and carries a verified email.
 */
export function readIdToken(idToken: string, clientId: string, nowMs = Date.now()): GoogleProfile | null {
  const parts = idToken.split('.')
  if (parts.length !== 3) return null
  let claims: Record<string, unknown>
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
  const { iss, aud, exp, sub, email, email_verified: verified, name } = claims
  if (typeof iss !== 'string' || !ISSUERS.includes(iss)) return null
  if (aud !== clientId) return null
  if (typeof exp !== 'number' || exp * 1000 < nowMs) return null
  if (typeof sub !== 'string' || !sub) return null
  if (typeof email !== 'string' || !email.includes('@')) return null
  if (verified !== true && verified !== 'true') return null
  return { sub, email: email.trim().toLowerCase(), name: typeof name === 'string' ? name : '' }
}

/** Swaps the one-time code from the redirect for the user's profile. Null on any failure. */
export async function exchangeCode(config: GoogleConfig, code: string): Promise<GoogleProfile | null> {
  try {
    const res = await fetch(tokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { id_token?: unknown }
    return typeof body.id_token === 'string' ? readIdToken(body.id_token, config.clientId) : null
  } catch {
    return null
  }
}

/**
 * Usernames to try for a new Google account, most natural first: the name,
 * then the email's first part, then numbered variants. All are 3-20
 * characters of letters, numbers and underscores.
 */
export function usernameCandidates(profile: { email: string; name: string }, random: () => number = Math.random): string[] {
  const clean = (text: string) =>
    text
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9_ ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 20)
  const bases = [clean(profile.name), clean(profile.email.split('@')[0])].filter((b) => b.length >= 3)
  const base = bases[0] ?? 'player'
  const numbered = Array.from({ length: 5 }, () => `${base.slice(0, 15)}_${Math.floor(1000 + random() * 9000)}`)
  return [...new Set([...bases, ...numbered])]
}
