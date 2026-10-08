import { Navigate } from 'react-router'
import AuthForm from '../components/AuthForm.tsx'
import { useCurrentUser } from '../lib/auth.ts'

/** Shared page for /login and /signup. Signed-in users are sent home. */
export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { data: user } = useCurrentUser()
  if (user) return <Navigate to="/" replace />

  return (
    <main className="flex justify-center px-4 py-16">
      {/* key resets the form fields when switching between the two modes */}
      <AuthForm key={mode} mode={mode} />
    </main>
  )
}
