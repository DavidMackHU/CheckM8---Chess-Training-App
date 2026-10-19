import { readClaims } from '../src/lib/firebaseClaims.js'
import { usernameCandidates } from '../src/lib/usernames.js'

const PROJECT = 'checkm8-test'
const NOW = 1_800_000_000

const good = {
  iss: `https://securetoken.google.com/${PROJECT}`,
  aud: PROJECT,
  sub: 'firebase-uid-1',
  auth_time: NOW - 10,
  email: 'Ada.Lovelace@Example.com',
  email_verified: true,
  name: 'Ada Lovelace',
  firebase: { sign_in_provider: 'google.com' },
}

describe('readClaims', () => {
  it('reads a sign-in and lower-cases the email', () => {
    expect(readClaims(good, PROJECT, NOW)).toEqual({
      uid: 'firebase-uid-1',
      email: 'ada.lovelace@example.com',
      emailVerified: true,
      name: 'Ada Lovelace',
      provider: 'google.com',
    })
  })

  it('keeps an unverified email, flagged as such', () => {
    expect(readClaims({ ...good, email_verified: false }, PROJECT, NOW)?.emailVerified).toBe(false)
  })

  it.each([
    ['another project', { aud: 'someone-else' }],
    ['another issuer', { iss: 'https://securetoken.google.com/someone-else' }],
    ['no user id', { sub: '' }],
    ['no email', { email: undefined }],
    ['a sign-in time in the future', { auth_time: NOW + 3600 }],
  ])('rejects %s', (_label, change) => {
    expect(readClaims({ ...good, ...change }, PROJECT, NOW)).toBeNull()
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
