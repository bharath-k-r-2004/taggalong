import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (window as any).__VITE_SUPABASE_URL__ || import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = (window as any).__VITE_SUPABASE_ANON_KEY__ || import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key:', supabaseAnonKey ? 'exists' : 'missing')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)