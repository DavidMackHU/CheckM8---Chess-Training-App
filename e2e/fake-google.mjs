// Stands in for Google's token endpoint during the browser tests, so the
// sign-in flow can be tested end to end without a real Google account.
// The "code" a test sends is the profile it wants back, as base64url JSON.
import { createServer } from 'node:http'

const PORT = 5999
const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

createServer((req, res) => {
  if (req.method !== 'POST') return res.writeHead(200).end('fake google')
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    const form = new URLSearchParams(body)
    let claims
    try {
      claims = JSON.parse(Buffer.from(form.get('code') ?? '', 'base64url').toString('utf8'))
    } catch {
      return res.writeHead(400).end()
    }
    const token = [
      part({ alg: 'none' }),
      part({
        iss: 'https://accounts.google.com',
        aud: form.get('client_id'),
        exp: Math.floor(Date.now() / 1000) + 600,
        email_verified: true,
        ...claims,
      }),
      'signature',
    ].join('.')
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id_token: token }))
  })
}).listen(PORT, () => console.log(`Fake Google token endpoint on http://localhost:${PORT}`))
