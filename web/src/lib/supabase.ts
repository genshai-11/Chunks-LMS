import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../env'
import type { Database } from '../types/database'

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> | null {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null
  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return client
}

/**
 * Attach Clerk session JWT for Supabase third-party auth.
 * Call after Clerk session is ready: supabase.realtime.setAuth(token)
 */
export async function setSupabaseAccessToken(token: string | null): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  if (token) {
    await supabase.realtime.setAuth(token)
  }
}
