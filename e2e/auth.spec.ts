import { expect, test } from '@playwright/test'
import { signUp } from './helpers.ts'

test('sign up, stay signed in, log out and log back in', async ({ page }) => {
  const name = `pw_ui_${Date.now().toString(36)}`
  await page.goto('/signup')
  await page.fill('input[name=email]', `${name}@example.com`)
  await page.fill('input[name=username]', name)
  await page.fill('input[name=password]', 'password123')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByTestId('nav-username')).toHaveText(name)

  await page.reload()
  await expect(page.getByTestId('nav-username')).toHaveText(name)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()

  await page.goto('/login')
  await page.fill('input[name=email]', `${name}@example.com`)
  await page.fill('input[name=password]', 'wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.')

  await page.fill('input[name=password]', 'password123')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByTestId('nav-username')).toHaveText(name)
})

test('sign-up rejects a taken email or username and weak input', async ({ page }) => {
  const user = await signUp(page, 'dup')
  const register = (data: object) => page.request.post('/api/auth/register', { data })

  const sameEmail = await register({ email: user.email.toUpperCase(), username: 'pw_other_name', password: 'password123' })
  expect(sameEmail.status()).toBe(409)
  expect((await sameEmail.json()).error).toBe('That email is already taken.')

  const sameName = await register({ email: 'pw_other@example.com', username: user.name.toUpperCase(), password: 'password123' })
  expect(sameName.status()).toBe(409)

  expect((await register({ email: 'nope', username: 'pw_x', password: 'password123' })).status()).toBe(400)
  expect((await register({ email: 'pw_y@example.com', username: 'pw_y', password: 'short' })).status()).toBe(400)
})

test('the session cookie is hidden from scripts and a forged one is refused', async ({ page, context }) => {
  await signUp(page, 'ck')
  const cookie = (await context.cookies()).find((c) => c.name === 'od_session')
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.sameSite).toBe('Lax')

  await context.clearCookies()
  await context.addCookies([{ name: 'od_session', value: 'abc.def.ghi', url: 'http://localhost:5173' }])
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
