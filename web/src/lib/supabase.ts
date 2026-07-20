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

export type SupabaseAuthCapabilities = { googleOAuth: boolean }

/** Read public GoTrue provider settings so disabled OAuth buttons are never shown. */
export async function getSupabaseAuthCapabilities(): Promise<SupabaseAuthCapabilities> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return { googleOAuth: false }
  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.supabaseAnonKey },
    })
    if (!response.ok) return { googleOAuth: false }
    const settings = (await response.json()) as { external?: { google?: boolean } }
    return { googleOAuth: settings.external?.google === true }
  } catch {
    return { googleOAuth: false }
  }
}
