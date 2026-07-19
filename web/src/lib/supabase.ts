import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../env'
import type { Database } from '../types/database'

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> | null {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null
  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

/**
 * Compatibility no-op retained for old call sites while migrating from Clerk
 * third-party JWTs to native Supabase Auth. Native sessions are managed by
 * `supabase.auth` and Realtime receives its access token automatically.
 */
export function setSupabaseAccessTokenProvider(_provider: (() => Promise<string | null>) | null): void {}

/** @deprecated Native Supabase Auth manages access tokens directly. */
export async function setSupabaseAccessToken(_token: string | null): Promise<void> {}
