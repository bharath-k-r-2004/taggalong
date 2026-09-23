import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { extractBatchFromEmail } from '../lib/batchExtractor'

export function AuthPage() {
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { error: authError, clearError } = useAuth()

  // Errors can come from: this page, the shared login state, or the Google callback
  const callbackError = (location.state as { authError?: string } | null)?.authError
  const error = localError || authError || callbackError || null

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setLocalError(null)
      clearError()

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Come back to the same site you started on
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            hd: 'iimrohtak.ac.in', // Google shows IIM Rohtak accounts first
            prompt: 'select_account'
          }
        }
      })

      if (signInError) {
        throw signInError
      }
    } catch (err) {
      console.error('Google sign-in error:', err)
      setLocalError(err instanceof Error ? err.message : 'Failed to sign in with Google')
      setLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = (formData.get('email') as string).trim().toLowerCase()
    const password = formData.get('password') as string
    const name = formData.get('name') as string

    try {
      setLoading(true)
      setLocalError(null)
      clearError()

      // Validate IIM email
      if (!email.endsWith('@iimrohtak.ac.in')) {
        throw new Error('Please use your IIM Rohtak email (@iimrohtak.ac.in)')
      }

      // Extract batch from email
      const batchInfo = extractBatchFromEmail(email)
      if (!batchInfo.course) {
        throw new Error('Invalid IIM email format. Expected format: pgp17xxxxx@iimrohtak.ac.in')
      }

      // Sign up. The database creates the matching `users` row automatically.
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          // The name the student typed. Programme and batch are read from the email.
          data: {
            display_name: name.trim()
          }
        }
      })

      if (signUpError) {
        throw signUpError
      }

      if (authData.user) {
        alert('Check your email to verify your account!')
        navigate('/')
      }
    } catch (err) {
      console.error('Sign up error:', err)
      setLocalError(err instanceof Error ? err.message : 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">TagAlong</h1>
          <p className="text-secondary-600">Find Your Ride. Trust Your Community.</p>
          <p className="text-sm text-secondary-500 mt-2">For IIM Rohtak Students</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border-2 border-secondary-300 text-secondary-700 py-3 rounded-lg font-semibold hover:bg-secondary-50 transition-colors flex items-center justify-center gap-3 mb-6 disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-secondary-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-secondary-500">or</span>
          </div>
        </div>

        {/* Email/Password Form */}
        {isRegistering && (
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Your name"
                className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                IIM Rohtak Email
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="pgp17xxxxx@iimrohtak.ac.in"
                className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-secondary-500 mt-1">
                Use your IIM Rohtak email to auto-extract your batch
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={() => setIsRegistering(false)}
              className="w-full text-primary-600 text-sm hover:underline"
            >
              Back
            </button>
          </form>
        )}

        {!isRegistering && (
          <div className="space-y-4">
            <p className="text-center text-secondary-600 text-sm">First time here?</p>
            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              className="w-full bg-primary-50 text-primary-600 py-2 rounded-lg font-semibold hover:bg-primary-100"
            >
              Create with Email
            </button>
            <p className="text-xs text-center text-secondary-500">
              We'll verify your IIM Rohtak email and auto-extract your batch
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
