// Stands in for Firebase Authentication during the browser tests.
//  - GET  /jwks           the public key the API checks tokens against (FIREBASE_JWKS_URL)
//  - POST /mint           a signed ID token for any profile, for tests that skip the sign-in form
//  - POST /v1/accounts:*  the few Firebase REST calls the sign-in form makes (see e2e/fakeFirebase.ts)
//  - GET  /sent?email=    which emails (verification, password reset) were "sent"
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const PORT = 5999
const PROJECT = 'e2e-project'
const KID = 'e2e-key'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }

/** email -> { uid, password, verified } */
const accounts = new Map()
/** email -> list of email types sent */
const sent = new Map()

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

function mint({ uid, email, email_verified = false, name, provider = 'password' }) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    auth_time: now,
    iat: now,
    exp: now + 3600,
    sub: uid ?? randomUUID(),
    user_id: uid,
    email,
    email_verified,
    ...(name ? { name } : {}),
    firebase: { sign_in_provider: provider, identities: { email: [email] } },
  }
  payload.user_id = payload.sub
  const input = `${b64({ alg: 'RS256', kid: KID, typ: 'JWT' })}.${b64(payload)}`
  const signature = createSign('RSA-SHA256').update(input).sign(privateKey).toString('base64url')
  return `${input}.${signature}`
}

const fail = (message) => ({ status: 400, body: { error: { code: 400, message, errors: [{ message }] } } })

function session(email, account) {
  return {
    kind: 'identitytoolkit#VerifyPasswordResponse',
    localId: account.uid,
    email,
    idToken: mint({ uid: account.uid, email, email_verified: account.verified }),
    refreshToken: `refresh-${account.uid}`,
    expiresIn: '3600',
    registered: true,
  }
}

const handlers = {
  '/mint': (b) => ({ status: 200, body: { idToken: mint(b) } }),
  '/v1/accounts:signUp': (b) => {
    const email = String(b.email ?? '').toLowerCase()
    if (accounts.has(email)) return fail('EMAIL_EXISTS')
    if (String(b.password ?? '').length < 6) return fail('WEAK_PASSWORD : Password should be at least 6 characters')
    const account = { uid: randomUUID(), password: b.password, verified: false }
    accounts.set(email, account)
    return { status: 200, body: session(email, account) }
  },
  '/v1/accounts:signInWithPassword': (b) => {
    const email = String(b.email ?? '').toLowerCase()
    const account = accounts.get(email)
    if (!account || account.password !== b.password) return fail('INVALID_LOGIN_CREDENTIALS')
    return { status: 200, body: session(email, account) }
  },
  '/v1/accounts:lookup': (b) => {
    const payload = JSON.parse(Buffer.from(String(b.idToken).split('.')[1], 'base64url').toString())
    const email = payload.email
    return {
      status: 200,
      body: {
        users: [
          {
            localId: payload.sub,
            email,
            emailVerified: payload.email_verified,
            providerUserInfo: [{ providerId: 'password', email, federatedId: email, rawId: email }],
            lastLoginAt: String(Date.now()),
            createdAt: String(Date.now()),
          },
        ],
      },
    }
  },
  '/v1/accounts:sendOobCode': (b) => {
    let email = b.email
    if (!email && b.idToken) email = JSON.parse(Buffer.from(String(b.idToken).split('.')[1], 'base64url').toString()).email
    email = String(email ?? '').toLowerCase()
    sent.set(email, [...(sent.get(email) ?? []), b.requestType])
    return { status: 200, body: { email } }
  },
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const reply = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
  if (req.method === 'GET') {
    if (url.pathname === '/jwks') return reply(200, { keys: [jwk] })
    if (url.pathname === '/sent') return reply(200, { sent: sent.get(String(url.searchParams.get('email')).toLowerCase()) ?? [] })
    return reply(200, { ok: true })
  }
  let raw = ''
  req.on('data', (chunk) => (raw += chunk))
  req.on('end', () => {
    const handler = handlers[url.pathname]
    if (!handler) return reply(404, { error: { code: 404, message: `fake-auth: no handler for ${url.pathname}` } })
    let body = {}
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      return reply(400, fail('INVALID_JSON').body)
    }
    const { status, body: out } = handler(body)
    reply(status, out)
  })
}).listen(PORT, () => console.log(`Fake Firebase on http://localhost:${PORT}`))
