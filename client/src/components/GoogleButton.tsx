/** Starts the Google sign-in. A plain link: the server redirects to Google and back. */
export default function GoogleButton() {
  return (
    <>
      <a
        href="/api/auth/google"
        data-testid="google-button"
        className="flex min-h-11 items-center justify-center gap-3 rounded-md border border-slate-600 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-100"
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.500-4.800 7.200l7.600 5.900c4.400-4.100 7-10.100 7-17.600z" />
          <path fill="#FBBC05" d="M10.500 28.600c-.5-1.400-.800-3-.800-4.600s.3-3.200.8-4.600l-7.900-6.200C1 16.500 0 20.100 0 24s1 7.500 2.600 10.800l7.900-6.200z" />
          <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.200-13.500-10l-7.900 6.200C6.500 42.600 14.600 48 24 48z" />
        </svg>
        Continue with Google
      </a>
      <p className="flex items-center gap-3 text-xs text-slate-500 before:h-px before:flex-1 before:bg-slate-800 after:h-px after:flex-1 after:bg-slate-800">
        or
      </p>
    </>
  )
}
