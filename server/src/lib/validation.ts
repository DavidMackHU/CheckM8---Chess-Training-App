export type RegisterInput = { email: string; username: string; password: string }
export type LoginInput = { email: string; password: string }
type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function parseRegister(body: unknown): Result<RegisterInput> {
  const b = (body ?? {}) as Record<string, unknown>
  const email = str(b.email).trim().toLowerCase()
  const username = str(b.username).trim()
  const password = str(b.password)
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: 'Username must be 3-20 letters, numbers or underscores.' }
  }
  if (password.length < 8 || password.length > 72) {
    return { ok: false, error: 'Password must be 8-72 characters.' }
  }
  return { ok: true, data: { email, username, password } }
}

export function parseLogin(body: unknown): Result<LoginInput> {
  const b = (body ?? {}) as Record<string, unknown>
  const email = str(b.email).trim().toLowerCase()
  const password = str(b.password)
  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' }
  }
  return { ok: true, data: { email, password } }
}
