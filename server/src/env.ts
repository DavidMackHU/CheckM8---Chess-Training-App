const isProduction = process.env.NODE_ENV === 'production'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See server/.env.example.`)
  }
  return value
}

export const env = {
  isProduction,
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  /** Optional. Without it, Human moves mode falls back to picking replies evenly. */
  lichessToken: process.env.LICHESS_TOKEN || undefined,
  // Secure cookies need HTTPS. On by default in production, off for local HTTP.
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : isProduction,
}
