export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

/**
 * Usernames to try for an account whose owner did not choose one (Google
 * sign-in), most natural first: the name, then the email's first part, then
 * numbered variants. All are 3-20 letters, numbers and underscores.
 */
export function usernameCandidates(profile: { email: string; name: string }, random: () => number = Math.random): string[] {
  const clean = (text: string) =>
    text
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9_ ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 20)
  const bases = [clean(profile.name), clean(profile.email.split('@')[0])].filter((b) => b.length >= 3)
  const base = bases[0] ?? 'player'
  const numbered = Array.from({ length: 5 }, () => `${base.slice(0, 15)}_${Math.floor(1000 + random() * 9000)}`)
  return [...new Set([...bases, ...numbered])]
}
