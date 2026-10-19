// Firebase Authentication in the browser. Firebase checks the password or the
// Google account; the server then swaps Firebase's token for the app's own
// login cookie (POST /api/auth/firebase), and Firebase is signed out again.
// The SDK is loaded on demand, so pages other than sign-in never download it.
import type { Auth, User as FirebaseUser } from 'firebase/auth'
import { ApiError, apiGet, apiPost } from './api.ts'
import type { User } from './auth.ts'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
}

/** False until the VITE_FIREBASE_* settings are filled in (see client/.env.example). */
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId)

let authPromise: Promise<Auth> | null = null
function getAuthInstance(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ initializeApp }, { getAuth }] = await Promise.all([import('firebase/app'), import('firebase/auth')])
    return getAuth(initializeApp(config))
  })()
  return authPromise
}

/** Error with a message that is safe to show. */
export class SignInError extends Error {}

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/email-already-in-use': 'That email already has an account. Log in instead.',
  'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
  'auth/network-request-failed': 'Could not reach the sign-in service. Check your connection.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain': 'Sign-in is not enabled for this web address yet.',
}

const codeOf = (err: unknown) => (err && typeof err === 'object' && 'code' in err ? String(err.code) : '')

function friendly(err: unknown): Error {
  if (err instanceof SignInError || err instanceof ApiError) return err
  return new SignInError(MESSAGES[codeOf(err)] ?? 'Sign-in failed. Try again.')
}

/** Trades the Firebase sign-in for the app's cookie, then drops the Firebase session. */
async function exchange(user: FirebaseUser, username?: string): Promise<User> {
  const auth = await getAuthInstance()
  try {
    const idToken = await user.getIdToken()
    return (await apiPost<{ user: User }>('/auth/firebase', { idToken, username })).user
  } finally {
    const { signOut } = await import('firebase/auth')
    await signOut(auth).catch(() => undefined)
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  const auth = await getAuthInstance()
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider())
    return await exchange(user)
  } catch (err) {
    // Closing the Google window is not an error worth showing.
    if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(codeOf(err))) return null
    throw friendly(err)
  }
}

/**
 * Email and password login. Accounts made before Firebase are not known to
 * Firebase yet: for those the old password is checked by the server, and the
 * account is then moved onto Firebase with that same password.
 */
export async function logInWithEmail(email: string, password: string): Promise<User> {
  const auth = await getAuthInstance()
  const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import('firebase/auth')
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password)
    return await exchange(user)
  } catch (err) {
    if (codeOf(err) !== 'auth/invalid-credential' && codeOf(err) !== 'auth/user-not-found') throw friendly(err)
  }
  // Not a Firebase account (or a wrong password). Try the pre-Firebase login.
  try {
    await apiPost('/auth/login', { email, password })
  } catch (err) {
    throw err instanceof ApiError && err.status === 401 ? new SignInError('Wrong email or password.') : friendly(err)
  }
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    return await exchange(user)
  } catch (err) {
    // The old login worked, so the user is signed in either way.
    console.warn('Could not move this account onto Firebase yet:', codeOf(err))
    return (await apiGet<{ user: User }>('/auth/me')).user
  }
}

export async function signUpWithEmail(email: string, username: string, password: string): Promise<User> {
  const check = await apiGet<{ available: boolean }>(`/auth/username-available?username=${encodeURIComponent(username)}`)
  if (!check.available) throw new SignInError('That username is already taken.')
  const auth = await getAuthInstance()
  const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth')
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    await sendEmailVerification(user).catch(() => undefined)
    return await exchange(user, username)
  } catch (err) {
    throw friendly(err)
  }
}

/** Always reports success, so the form does not reveal which emails have accounts. */
export async function sendPasswordReset(email: string): Promise<void> {
  const auth = await getAuthInstance()
  const { sendPasswordResetEmail } = await import('firebase/auth')
  try {
    await sendPasswordResetEmail(auth, email)
  } catch (err) {
    const code = codeOf(err)
    if (code === 'auth/invalid-email' || code === 'auth/missing-email' || code === 'auth/network-request-failed') throw friendly(err)
  }
}
