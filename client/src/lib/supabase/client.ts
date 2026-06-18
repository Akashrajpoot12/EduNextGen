import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'


// Cache the client instance so we don't recreate it on every call in React SPA
let supabaseInstance: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createClient() {
  if (supabaseInstance) return supabaseInstance;
  
  supabaseInstance = createSupabaseClient<Database>(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!
  )
  return supabaseInstance;
}
