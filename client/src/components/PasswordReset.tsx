import { type FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { sendPasswordReset } from '../lib/firebase.ts'
import { inputClass } from './AuthForm.tsx'

type Props = { initialEmail: string; onDone: () => void }

/** "Forgot password?": Firebase emails a link to choose a new password. */
export default function PasswordReset({ initialEmail, onDone }: Props) {
  const [email, setEmail] = useState(initialEmail)
  const reset = useMutation({ mutationFn: sendPasswordReset })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    reset.mutate(email)
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4" data-testid="password-reset">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {reset.isSuccess ? (
        <p role="status" className="text-sm text-slate-300">
          If {email} has an account, a link to choose a new password is on its way. Check your spam folder too.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-400">We will email you a link to choose a new password.</p>
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
          {reset.isError && (
            <p role="alert" className="text-sm text-red-400">
              {reset.error.message}
            </p>
          )}
          <button
            type="submit"
            disabled={reset.isPending}
            className="min-h-11 rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {reset.isPending ? 'Sending...' : 'Send reset link'}
          </button>
        </>
      )}
      <button type="button" onClick={onDone} className="self-start text-sm text-emerald-400 underline">
        Back to log in
      </button>
    </form>
  )
}
