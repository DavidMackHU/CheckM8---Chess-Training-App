import { googleAuthUrl, googleConfig, readIdToken, usernameCandidates } from '../src/lib/google.js'

const CLIENT = 'client-123.apps.googleusercontent.com'
const NOW = 1_800_000_000_000

function token(claims: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({ alg: 'RS256' })}.${part(claims)}.signature`
}

const good = {
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  exp: NOW / 1000 + 600,
  sub: '1234567890',
  email: 'Ada.Lovelace@Example.com',
  email_verified: true,
  name: 'Ada Lovelace',
}

describe('readIdToken', () => {
  it('reads a valid token and lower-cases the email', () => {
    expect(readIdToken(token(good), CLIENT, NOW)).toEqual({ sub: '1234567890', email: 'ada.lovelace@example.com', name: 'Ada Lovelace' })
  })

  it.each([
    ['another issuer', { iss: 'https://evil.example' }],
    ['another app', { aud: 'someone-else' }],
    ['an expired token', { exp: NOW / 1000 - 1 }],
    ['an unverified email', { email_verified: false }],
    ['a missing email', { email: undefined }],
    ['a missing subject', { sub: '' }],
  ])('rejects %s', (_label, change) => {
    expect(readIdToken(token({ ...good, ...change }), CLIENT, NOW)).toBeNull()
  })

  it('rejects text that is not a token', () => {
    expect(readIdToken('not-a-token', CLIENT, NOW)).toBeNull()
    expect(readIdToken('a.%%%.c', CLIENT, NOW)).toBeNull()
  })
})

describe('usernameCandidates', () => {
  const valid = /^[A-Za-z0-9_]{3,20}$/

  it('prefers the name, then the email, then numbered variants', () => {
    const names = usernameCandidates({ email: 'ada99@example.com', name: 'Ada Lovelace' }, () => 0)
    expect(names.slice(0, 3)).toEqual(['Ada_Lovelace', 'ada99', 'Ada_Lovelace_1000'])
    for (const name of names) expect(name).toMatch(valid)
  })

  it('copes with names that have no usable characters', () => {
    const names = usernameCandidates({ email: 'x@example.com', name: '李 雷' }, () => 0.5)
    expect(names[0]).toBe('player_5500')
    for (const name of names) expect(name).toMatch(valid)
  })

  it('keeps long names within the limit', () => {
    const names = usernameCandidates({ email: 'a.very.long.address.indeed@example.com', name: 'Maximilian Alexander von Habsburg' })
    for (const name of names) expect(name).toMatch(valid)
  })
})

describe('googleConfig', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('is off unless both the id and the secret are set', () => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    expect(googleConfig()).toBeNull()
    process.env.GOOGLE_CLIENT_ID = CLIENT
    expect(googleConfig()).toBeNull()
  })

  it('builds the redirect address from the public site address', () => {
    process.env.GOOGLE_CLIENT_ID = CLIENT
    process.env.GOOGLE_CLIENT_SECRET = 'secret'
    process.env.PUBLIC_URL = 'https://example.vercel.app/'
    const config = googleConfig()!
    expect(config.redirectUri).toBe('https://example.vercel.app/api/auth/google/callback')
    const url = new URL(googleAuthUrl(config, 'abc'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('state')).toBe('abc')
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri)
    expect(url.searchParams.get('scope')).toBe('openid email profile')
  })
})
