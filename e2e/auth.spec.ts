import { expect, type Page, test } from '@playwright/test'
import { mintToken, sentEmails, useFakeFirebase } from './fakeFirebase.ts'
import { signUp, sql, testName } from './helpers.ts'
import { BASE_URL } from './ports.ts'

// Firebase is played by e2e/fake-auth.mjs; the sign-in form, the SDK and our API run for real.

async function fillSignUp(page: Page, email: string, username: string, password: string) {
  await page.goto('/signup')
  await page.fill('input[name=email]', email)
  await page.fill('input[name=username]', username)
  await page.fill('input[name=password]', password)
  await page.getByRole('button', { name: 'Sign up' }).click()
}

async function fillLogIn(page: Page, email: string, password: string) {
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

test('sign up, stay signed in, log out and log back in', async ({ page }) => {
  await useFakeFirebase(page)
  const name = testName('ui')
  const email = `${name}@example.com`
  await fillSignUp(page, email, name, 'password123')
  await expect(page.getByTestId('nav-username')).toHaveText(name)
  expect(await sentEmails(email)).toEqual(['VERIFY_EMAIL'])

  await page.reload()
  await expect(page.getByTestId('nav-username')).toHaveText(name)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()

  await page.goto('/login')
  await fillLogIn(page, email, 'wrong-password')
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.')

  await page.fill('input[name=password]', 'password123')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.locator('input[name=password]')).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByTestId('nav-username')).toHaveText(name)
})

test('sign-up refuses a taken username or email', async ({ page }) => {
  await useFakeFirebase(page)
  const user = await signUp(page, 'dup')
  await page.context().clearCookies()

  // Taken username: caught before any Firebase account is made.
  const other = testName('dq')
  await fillSignUp(page, `${other}@example.com`, user.name.toUpperCase(), 'password123')
  await expect(page.getByRole('alert')).toHaveText('That username is already taken.')
  expect(await sentEmails(`${other}@example.com`)).toEqual([])

  // Taken email.
  await fillSignUp(page, `${other}@example.com`, other, 'password123')
  await expect(page.getByTestId('nav-username')).toHaveText(other)
  await page.getByRole('button', { name: 'Log out' }).click()
  await fillSignUp(page, `${other}@example.com`, testName('dr'), 'password123')
  await expect(page.getByRole('alert')).toHaveText('That email already has an account. Log in instead.')
})

test('forgot password sends a reset email without saying whether the account exists', async ({ page }) => {
  await useFakeFirebase(page)
  await page.goto('/login')
  await page.fill('input[name=email]', 'pw_reset@example.com')
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.locator('[data-testid=password-reset] input[name=email]')).toHaveValue('pw_reset@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText('If pw_reset@example.com has an account')
  expect(await sentEmails('pw_reset@example.com')).toEqual(['PASSWORD_RESET'])
  await page.getByRole('button', { name: 'Back to log in' }).click()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})

test('an account from before Firebase moves over on its first login', async ({ page }) => {
  await useFakeFirebase(page)
  const name = testName('old')
  const email = `${name}@example.com`
  const { default: bcrypt } = await import('bcryptjs')
  await sql(`INSERT INTO "User" (id, email, username, "passwordHash") VALUES ($1, $2, $3, $4)`, [
    `pw${name}`,
    email,
    name,
    await bcrypt.hash('password123', 4),
  ])

  await page.goto('/login')
  await fillLogIn(page, email, 'wrong-password')
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.')
  await fillLogIn(page, email, 'password123')
  await expect(page.getByTestId('nav-username')).toHaveText(name)

  const [row] = await sql<{ firebaseUid: string | null; passwordHash: string | null }>(
    `SELECT "firebaseUid", "passwordHash" FROM "User" WHERE id = $1`,
    [`pw${name}`],
  )
  expect(row.firebaseUid).toBeTruthy()
  expect(row.passwordHash).toBeNull()

  // From now on Firebase checks the password, and the old login is gone.
  await page.getByRole('button', { name: 'Log out' }).click()
  const old = await page.request.post('/api/auth/login', { data: { email, password: 'password123' } })
  expect(old.status()).toBe(401)
  await page.goto('/login')
  await fillLogIn(page, email, 'password123')
  await expect(page.getByTestId('nav-username')).toHaveText(name)
})

test('a Google sign-in gets an account, and finds it again next time', async ({ page }) => {
  const name = testName('gg')
  const email = `${name}@example.com`
  const google = { uid: `google-${name}`, email, email_verified: true, name: name.replaceAll('_', ' '), provider: 'google.com' }

  const first = await page.request.post('/api/auth/firebase', { data: { idToken: await mintToken(google) } })
  expect(first.status()).toBe(200)
  expect((await first.json()).user.username).toBe(name)

  await page.context().clearCookies()
  const again = await page.request.post('/api/auth/firebase', { data: { idToken: await mintToken({ ...google, name: 'Someone Else' }) } })
  expect((await again.json()).user.username).toBe(name)
  expect(await sql(`SELECT id FROM "User" WHERE email = $1`, [email])).toHaveLength(1)
})

test('an existing account is only joined with proof of owning its email', async ({ page }) => {
  const user = await signUp(page, 'own')
  await page.context().clearCookies()
  const claim = async (verified: boolean) =>
    page.request.post('/api/auth/firebase', {
      data: { idToken: await mintToken({ uid: `other-${user.name}-${verified}`, email: user.email, email_verified: verified }) },
    })

  // The account already belongs to another Firebase user.
  expect((await claim(true)).status()).toBe(409)

  // A pre-Firebase account: unverified emails cannot take it over, verified ones can.
  await sql(`UPDATE "User" SET "firebaseUid" = NULL WHERE username = $1`, [user.name])
  const unverified = await claim(false)
  expect(unverified.status()).toBe(409)
  expect((await unverified.json()).error).toBe('An account with this email already exists. Log in to it instead.')
  const verified = await claim(true)
  expect(verified.status()).toBe(200)
  expect((await verified.json()).user.username).toBe(user.name)
})

test('forged or foreign tokens are refused', async ({ page }) => {
  const token = await mintToken({ email: 'pw_forged@example.com' })
  const [header, payload] = token.split('.')
  const tampered = `${header}.${payload.slice(0, -4)}AAAA.${token.split('.')[2]}`
  for (const idToken of ['not-a-token', tampered, `${header}.${payload}.`]) {
    const res = await page.request.post('/api/auth/firebase', { data: { idToken } })
    expect(res.status(), idToken.slice(0, 20)).toBe(401)
  }
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
})

test('the session cookie is hidden from scripts and a forged one is refused', async ({ page, context }) => {
  await signUp(page, 'ck')
  const cookie = (await context.cookies()).find((c) => c.name === 'od_session')
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.sameSite).toBe('Lax')

  await context.clearCookies()
  await context.addCookies([{ name: 'od_session', value: 'abc.def.ghi', url: BASE_URL }])
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
})

test('pages that need an account ask guests to log in', async ({ page }) => {
  for (const [path, text] of [
    ['/dashboard', 'Log in to see your progress'],
    ['/train/review', 'Log in to review'],
    ['/creator/new', 'Log in to create a course'],
  ]) {
    await page.goto(path)
    await expect(page.getByText(text)).toBeVisible()
  }
})
