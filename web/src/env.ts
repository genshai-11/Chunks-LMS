import { z } from 'zod'

const envSchema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional().default(''),
  VITE_SUPABASE_URL: z.string().url().optional().or(z.literal('')).default(''),
  VITE_SUPABASE_ANON_KEY: z.string().optional().default(''),
  VITE_AUTH_BYPASS: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  MODE: z.string().optional(),
  DEV: z.boolean().optional(),
  PROD: z.boolean().optional(),
})

export type AppEnv = {
  clerkPublishableKey: string
  supabaseUrl: string
  supabaseAnonKey: string
  authBypass: boolean
  isConfigured: boolean
}

function readEnv(): AppEnv {
  const parsed = envSchema.safeParse({
    VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_AUTH_BYPASS: import.meta.env.VITE_AUTH_BYPASS ?? 'false',
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  })

  if (!parsed.success) {
    console.warn('Environment validation warnings', parsed.error.flatten())
  }

  const data = parsed.success
    ? parsed.data
    : {
        VITE_CLERK_PUBLISHABLE_KEY: '',
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: '',
        VITE_AUTH_BYPASS: false,
      }

  const clerkPublishableKey = data.VITE_CLERK_PUBLISHABLE_KEY
  const supabaseUrl = data.VITE_SUPABASE_URL
  const supabaseAnonKey = data.VITE_SUPABASE_ANON_KEY

  return {
    clerkPublishableKey,
    supabaseUrl,
    supabaseAnonKey,
    authBypass: data.VITE_AUTH_BYPASS,
    isConfigured: Boolean(clerkPublishableKey && supabaseUrl && supabaseAnonKey),
  }
}

export const env = readEnv()
