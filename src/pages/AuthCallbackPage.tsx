import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Read any error Google/Supabase put in the address bar. This runs as soon as
// the app loads, before Supabase tidies the address bar.
function readUrlError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  return (
    hash.get('error_description') ||
    query.get('error_description') ||
    hash.get('error') ||
    query.get('error')
  )
}

const initialUrlError = window.location.pathname.startsWith('/auth/callback')
  ? readUrlError()
  : null

export function AuthCallbackPage() {
  const { user, loading } = useAuth()

  if (user) {
    return <Navigate to="/" replace />
  }

  if (!loading) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{
          authError: initialUrlError || 'Sign-in did not finish. Please try again.'
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-white">Signing you in...</p>
      </div>
    </div>
  )
}
