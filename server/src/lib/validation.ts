export type LoginInput = { email: string; password: string }
type Result<T> = { ok: true; data: T } | { ok: false; error: string }

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
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
