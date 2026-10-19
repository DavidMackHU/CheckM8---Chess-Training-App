import type { Page } from '@playwright/test'

// Helpers around e2e/fake-auth.mjs, which plays Firebase during the tests.
export const FAKE_AUTH = 'http://localhost:5999'

/**
 * Sends the page's Firebase calls to the fake instead of Google. Without
 * this, the sign-in form would try to reach the real Firebase.
 */
export async function useFakeFirebase(page: Page) {
  await page.route('https://identitytoolkit.googleapis.com/**', async (route) => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    }
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const path = new URL(request.url()).pathname
    const res = await fetch(`${FAKE_AUTH}${path}`, { method: 'POST', body: request.postData() ?? '{}' })
    await route.fulfill({ status: res.status, headers: { ...cors, 'Content-Type': 'application/json' }, body: await res.text() })
  })
}

/** A signed Firebase ID token for this profile, as if they had just signed in. */
export async function mintToken(profile: { email: string; uid?: string; name?: string; email_verified?: boolean; provider?: string }) {
  const res = await fetch(`${FAKE_AUTH}/mint`, { method: 'POST', body: JSON.stringify(profile) })
  return ((await res.json()) as { idToken: string }).idToken
}

/** Which emails Firebase was asked to send to this address, e.g. ["VERIFY_EMAIL"]. */
export async function sentEmails(email: string): Promise<string[]> {
  const res = await fetch(`${FAKE_AUTH}/sent?email=${encodeURIComponent(email)}`)
  return ((await res.json()) as { sent: string[] }).sent
}
