import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

// Shown once, right after a student's first sign-in, until they type their name.
export function NamePage() {
  const { user, updateName, signOut } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const course = user?.user_metadata?.course
  const batch = user?.user_metadata?.batch

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await updateName(name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your name')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h1 className="text-3xl font-bold text-primary-600 mb-2 text-center">Welcome to TagAlong</h1>
        <p className="text-secondary-600 text-center mb-8">
          Tell us your name so co-travellers know who they're riding with.
        </p>

        {/* Read from the IIM email, not editable */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-secondary-50 rounded-lg p-3">
            <p className="text-xs text-secondary-500 mb-1">Programme</p>
            <p className="text-lg font-semibold text-secondary-900">{course || 'N/A'}</p>
          </div>
          <div className="bg-secondary-50 rounded-lg p-3">
            <p className="text-xs text-secondary-500 mb-1">Batch</p>
            <p className="text-lg font-semibold text-secondary-900">{batch || 'N/A'}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="full-name" className="block text-sm font-medium text-secondary-700 mb-1">
              Your name
            </label>
            <input
              id="full-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              minLength={2}
              maxLength={60}
              autoFocus
              placeholder="e.g. Priya Sharma"
              className="w-full px-4 py-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving || name.trim().length < 2}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full text-secondary-500 text-sm mt-6 hover:underline"
        >
          Not you? Sign out
        </button>
      </div>
    </div>
  )
}
