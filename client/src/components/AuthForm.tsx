import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSignIn } from '../lib/auth.ts'
import { firebaseConfigured, logInWithEmail, signInWithGoogle, signUpWithEmail } from '../lib/firebase.ts'
import GoogleButton from './GoogleButton.tsx'
import PasswordReset from './PasswordReset.tsx'

type Props = { mode: 'login' | 'signup' }

export const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400'

export default function AuthForm({ mode }: Props) {
  const isSignup = mode === 'signup'
  const signIn = useSignIn()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetting, setResetting] = useState(false)

  const onSuccess = (user: unknown) => {
    if (user) navigate('/')
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const action = isSignup ? () => signUpWithEmail(email, username, password) : () => logInWithEmail(email, password)
    signIn.mutate(action, { onSuccess })
  }

  if (!firebaseConfigured) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3" data-testid="auth-unavailable">
        <h1 className="text-2xl font-semibold">{isSignup ? 'Create your account' : 'Log in'}</h1>
        <p className="text-sm text-slate-400">Sign-in is not set up on this server yet.</p>
      </div>
    )
  }

  if (resetting) return <PasswordReset initialEmail={email} onDone={() => setResetting(false)} />

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">{isSignup ? 'Create your account' : 'Log in'}</h1>

      <GoogleButton disabled={signIn.isPending} onClick={() => signIn.mutate(signInWithGoogle, { onSuccess })} />

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      {isSignup && (
        <label className="flex flex-col gap-1 text-sm">
          Username
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]+"
            title="Letters, numbers and underscores only"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      {/* A div, not a label: the buttons inside must not become part of the field's name. */}
      <div className="flex flex-col gap-1 text-sm">
        <span className="flex items-baseline justify-between">
          <label htmlFor="password">Password</label>
          {!isSignup && (
            <button type="button" onClick={() => setResetting(true)} className="text-xs text-emerald-400 underline">
              Forgot password?
            </button>
          )}
        </span>
        <span className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={isSignup ? 8 : undefined}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 px-3 text-xs text-slate-400 hover:text-slate-200"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </span>
        {isSignup && <span className="text-xs text-slate-500">At least 8 characters.</span>}
      </div>

      {signIn.isError && (
        <p role="alert" className="text-sm text-red-400">
          {signIn.error.message}
        </p>
      )}
      <button
        type="submit"
        disabled={signIn.isPending}
        className="min-h-11 rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {signIn.isPending ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
      </button>
      <p className="text-sm text-slate-400">
        {isSignup ? 'Already have an account? ' : 'New here? '}
        <Link to={isSignup ? '/login' : '/signup'} className="text-emerald-400 underline">
          {isSignup ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </form>
  )
}
