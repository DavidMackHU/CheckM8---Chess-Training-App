import { expect, type Page, test } from '@playwright/test'
import { signUp, sql } from './helpers.ts'

// Google itself is replaced by e2e/fake-google.mjs (see playwright.config.ts).
// Everything on our side of the sign-in runs for real.

const unique = (tag: string) => `pw_${tag}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20)
const asCode = (profile: object) => Buffer.from(JSON.stringify(profile)).toString('base64url')

/** Starts a sign-in the way the button does and returns the state value sent to Google. */
async function start(page: Page): Promise<string> {
  const res = await page.request.get('/api/auth/google', { maxRedirects: 0 })
  expect(res.status()).toBe(302)
  const url = new URL(res.headers().location)
  expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/api/auth/google/callback')
  return url.searchParams.get('state')!
}

/** Plays Google's part: sends the browser back to us as if this profile had just signed in. */
async function comeBack(page: Page, state: string, profile: object) {
  await page.goto(`/api/auth/google/callback?code=${asCode(profile)}&state=${state}`)
}

test.beforeEach(async ({ page }) => {
  const { google } = await (await page.request.get('/api/auth/providers')).json()
  test.skip(!google, 'the running server was not started by Playwright, so Google sign-in is not configured')
})

test('the sign-in pages offer Google, and a new Google user gets an account', async ({ page }) => {
  const name = unique('gg')
  await page.goto('/login')
  await expect(page.getByTestId('google-button')).toHaveAttribute('href', '/api/auth/google')
  await page.goto('/signup')
  await expect(page.getByTestId('google-button')).toBeVisible()

  await comeBack(page, await start(page), { sub: `sub-${name}`, email: `${name}@example.com`, name: name.replaceAll('_', ' ') })
  await expect(page).toHaveURL('http://localhost:5173/')
  await expect(page.getByTestId('nav-username')).toHaveText(name)

  // Signing in again finds the same account rather than making a second one.
  await page.getByRole('button', { name: 'Log out' }).click()
  await comeBack(page, await start(page), { sub: `sub-${name}`, email: `${name}@example.com`, name: 'Someone Else' })
  await expect(page.getByTestId('nav-username')).toHaveText(name)
  const rows = await sql(`SELECT id FROM "User" WHERE email = $1`, [`${name}@example.com`])
  expect(rows).toHaveLength(1)

  // A Google-only account has no password to guess.
  const login = await page.request.post('/api/auth/login', { data: { email: `${name}@example.com`, password: 'password123' } })
  expect(login.status()).toBe(401)
})

test('Google sign-in joins an existing account with the same email and retires its password', async ({ page }) => {
  const user = await signUp(page, 'gl')
  await page.context().clearCookies()

  await comeBack(page, await start(page), { sub: `sub-${user.name}`, email: user.email.toUpperCase(), name: 'Ignored' })
  await expect(page.getByTestId('nav-username')).toHaveText(user.name)

  const old = await page.request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
  expect(old.status()).toBe(401)
})

test('a taken username gets a numbered variant', async ({ page }) => {
  const user = await signUp(page, 'gn')
  await page.context().clearCookies()
  const other = unique('go')

  // The name matches the existing user, and the email's first part is too short to use.
  await comeBack(page, await start(page), { sub: `sub-${other}`, email: 'x@pw-other.example.com', name: user.name })
  const shown = await page.getByTestId('nav-username').innerText()
  expect(shown).toMatch(new RegExp(`^${user.name.slice(0, 15)}_\\d{4}$`))
  await sql(`DELETE FROM "User" WHERE email = 'x@pw-other.example.com'`)
})

test('a reply that does not belong to this browser is refused', async ({ page }) => {
  const name = unique('gx')
  const profile = { sub: `sub-${name}`, email: `${name}@example.com`, name }

  // No sign-in was started, so there is nothing to match the state against.
  await comeBack(page, 'made-up-state', profile)
  await expect(page).toHaveURL(/\/login\?error=google_failed$/)
  await expect(page.getByRole('alert')).toContainText('Google sign-in did not complete.')

  // Started, but the state that comes back is not the one we sent.
  await start(page)
  await comeBack(page, 'another-state', profile)
  await expect(page).toHaveURL(/\/login\?error=google_failed$/)

  // An unverified email is not trusted either.
  await comeBack(page, await start(page), { ...profile, email_verified: false })
  await expect(page).toHaveURL(/\/login\?error=google_failed$/)

  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
  expect(await sql(`SELECT id FROM "User" WHERE email = $1`, [`${name}@example.com`])).toHaveLength(0)
})
