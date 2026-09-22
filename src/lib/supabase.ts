import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tjuyeqorhhrppislcmlf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqdXllcW9yaGhycHBpc2xjbWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NjMwOTgsImV4cCI6MjEwNDUzOTA5OH0.ICTL7raLX-MY7A89c3h42qG73RbbaRLq6GDqEdB0P-I'

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key:', supabaseAnonKey ? 'exists' : 'missing')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)