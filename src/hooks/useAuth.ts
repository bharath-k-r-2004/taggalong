import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

export interface AuthUser extends User {
  course?: string
  batch?: string
  full_batch?: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check current session
    const checkAuth = async () => {
      try {
        const {
          data: { user: currentUser },
          error: authError
        } = await supabase.auth.getUser()

        if (authError) throw authError

        if (currentUser) {
          // Fetch user profile from users table
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single()

          if (!profileError && profile) {
            setUser({
              ...currentUser,
              ...profile
            })
          } else {
            setUser(currentUser as AuthUser)
          }
        }
        setLoading(false)
      } catch (err) {
        console.error('Auth check error:', err)
        setError(err instanceof Error ? err.message : 'Auth error')
        setLoading(false)
      }
    }

    checkAuth()

    // Subscribe to auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setUser({
          ...session.user,
          ...profile
        } as AuthUser)
      } else {
        setUser(null)
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
    } catch (err) {
      console.error('Sign out error:', err)
      setError(err instanceof Error ? err.message : 'Sign out error')
    }
  }

  return { user, loading, error, signOut }
}
