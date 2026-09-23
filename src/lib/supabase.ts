import { createClient } from '@supabase/supabase-js'

// Project address and PUBLISHABLE key (Supabase → Project Settings → API Keys).
// The publishable key is meant to be public; the database's security rules protect the data.
const supabaseUrl = 'https://tjuyeqorhhrppislcmlf.supabase.co'
const supabasePublishableKey = 'sb_publishable_FCUKf1pM47sH5ZSu42DcaQ_3-FpsUgg'

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
