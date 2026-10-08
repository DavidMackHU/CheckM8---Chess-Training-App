import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLogin, useRegister } from '../lib/auth.ts'

type Props = { mode: 'login' | 'signup' }

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400'

export default function AuthForm({ mode }: Props) {
  const isSignup = mode === 'signup'
  const login = useLogin()
  const register = useRegister()
  const mutation = isSignup ? register : login
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const credentials = isSignup ? { email, username, password } : { email, password }
    mutation.mutate(credentials, { onSuccess: () => navigate('/') })
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">{isSignup ? 'Create your account' : 'Log in'}</h1>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
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

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          name="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={isSignup ? 8 : undefined}
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {isSignup && <span className="text-xs text-slate-500">At least 8 characters.</span>}
      </label>

      {mutation.isError && (
        <p role="alert" className="text-sm text-red-400">
          {mutation.error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {mutation.isPending ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
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
