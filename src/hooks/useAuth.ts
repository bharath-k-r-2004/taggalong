import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const ALLOWED_DOMAIN = '@iimrohtak.ac.in'

export interface AuthUser extends User {
  name?: string
  course?: string
  batch?: string
  full_batch?: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  clearError: () => void
  signOut: () => Promise<void>
  updateName: (name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Combine the login account with the row in the `users` table so every page
// can keep reading name / batch / course from user.user_metadata.
// Programme and batch come from the email; the name is only what the student
// typed themselves (never copied from their Google account).
async function loadProfile(authUser: User): Promise<AuthUser> {
  const { data: profile, error } = await supabase
    .from('users')
    .select('id, name, course, batch, full_batch')
    .eq('id', authUser.id)
    .maybeSingle()

  if (error) console.error('Profile fetch error:', error)

  const meta = authUser.user_metadata || {}
  const name = profile?.name || undefined
  const course = profile?.course || meta.course
  const batch = profile?.batch || meta.batch
  const full_batch = profile?.full_batch || meta.full_batch

  return {
    ...authUser,
    name,
    course,
    batch,
    full_batch,
    user_metadata: { ...meta, name, course, batch, full_batch }
  }
}

// One shared login state for the whole app (wraps everything in App.tsx).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const latestRun = useRef(0)

  useEffect(() => {
    let active = true

    const applySession = async (session: Session | null) => {
      const run = ++latestRun.current
      const isCurrent = () => active && run === latestRun.current

      if (!session?.user) {
        if (isCurrent()) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      // TagAlong is IIM Rohtak only: sign out any other Google account.
      const email = (session.user.email || '').toLowerCase()
      if (!email.endsWith(ALLOWED_DOMAIN)) {
        await supabase.auth.signOut()
        if (isCurrent()) {
          setError(
            `TagAlong is only for IIM Rohtak students. Please sign in with your ${ALLOWED_DOMAIN} account.`
          )
          setUser(null)
          setLoading(false)
        }
        return
      }

      try {
        const fullUser = await loadProfile(session.user)
        if (isCurrent()) {
          setUser(fullUser)
          setError(null)
        }
      } catch (err) {
        console.error('Auth error:', err)
        if (isCurrent()) setUser(session.user as AuthUser)
      } finally {
        if (isCurrent()) setLoading(false)
      }
    }

    // First check when the app opens (also picks up the login returning from Google).
    supabase.auth.getSession().then(({ data }) => applySession(data.session))

    // Later changes: sign in, sign out, token refresh.
    // Supabase advises against calling other Supabase functions directly inside
    // this callback, so the work is deferred with setTimeout.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void applySession(session)
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      console.error('Sign out error:', signOutError)
      setError(signOutError.message)
    }
    setUser(null)
  }

  const clearError = () => setError(null)

  // Save the name the student typed (first login screen or Profile page)
  const updateName = async (newName: string) => {
    if (!user) throw new Error('You are not signed in.')

    const cleanName = newName.trim().replace(/\s+/g, ' ')
    if (cleanName.length < 2) throw new Error('Please enter your name.')
    if (cleanName.length > 60) throw new Error('Please keep your name under 60 characters.')

    const { data, error: updateError } = await supabase
      .from('users')
      .update({ name: cleanName, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id')

    if (updateError) throw updateError
    if (!data || data.length === 0) {
      throw new Error('Could not find your profile. Please sign out and sign in again.')
    }

    setUser(prev =>
      prev
        ? { ...prev, name: cleanName, user_metadata: { ...prev.user_metadata, name: cleanName } }
        : prev
    )
  }

  return createElement(
    AuthContext.Provider,
    { value: { user, loading, error, clearError, signOut, updateName } },
    children
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
