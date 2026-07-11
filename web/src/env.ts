import { z } from 'zod'
import { parseEmailList } from './auth/staff-roles'

const envSchema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional().default(''),
  VITE_SUPABASE_URL: z.string().url().optional().or(z.literal('')).default(''),
  VITE_SUPABASE_ANON_KEY: z.string().optional().default(''),
  VITE_AUTH_BYPASS: z.string().optional().default('false'),
  /** Comma-separated admin emails (Clerk primary email). Empty = bootstrap any signed-in staff. */
  VITE_STAFF_ADMIN_EMAILS: z.string().optional().default(''),
  /** Comma-separated teacher emails. Empty = bootstrap any signed-in staff. */
  VITE_STAFF_TEACHER_EMAILS: z.string().optional().default(''),
  MODE: z.string().optional(),
  DEV: z.boolean().optional(),
  PROD: z.boolean().optional(),
})

function truthy(raw: string | undefined): boolean {
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export type AppEnv = {
  clerkPublishableKey: string
  supabaseUrl: string
  supabaseAnonKey: string
  /** Local/CI only — grants Admin+Teacher without sign-in. Never true in production. */
  authBypass: boolean
  staffAdminEmails: string[]
  staffTeacherEmails: string[]
  /** Clerk + Supabase both configured */
  isConfigured: boolean
  /** App can boot (Clerk key or auth bypass) */
  canBoot: boolean
}

function readEnv(): AppEnv {
  const parsed = envSchema.safeParse({
    VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_AUTH_BYPASS: import.meta.env.VITE_AUTH_BYPASS,
    VITE_STAFF_ADMIN_EMAILS: import.meta.env.VITE_STAFF_ADMIN_EMAILS,
    VITE_STAFF_TEACHER_EMAILS: import.meta.env.VITE_STAFF_TEACHER_EMAILS,
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
        VITE_AUTH_BYPASS: 'false',
        VITE_STAFF_ADMIN_EMAILS: '',
        VITE_STAFF_TEACHER_EMAILS: '',
      }

  const clerkPublishableKey = data.VITE_CLERK_PUBLISHABLE_KEY
  const supabaseUrl = data.VITE_SUPABASE_URL
  const supabaseAnonKey = data.VITE_SUPABASE_ANON_KEY
  const authBypass = truthy(data.VITE_AUTH_BYPASS) && !import.meta.env.PROD

  if (truthy(data.VITE_AUTH_BYPASS) && import.meta.env.PROD) {
    console.warn('VITE_AUTH_BYPASS is ignored in production builds')
  }

  return {
    clerkPublishableKey,
    supabaseUrl,
    supabaseAnonKey,
    authBypass,
    staffAdminEmails: parseEmailList(data.VITE_STAFF_ADMIN_EMAILS),
    staffTeacherEmails: parseEmailList(data.VITE_STAFF_TEACHER_EMAILS),
    isConfigured: Boolean(clerkPublishableKey && supabaseUrl && supabaseAnonKey),
    canBoot: Boolean(clerkPublishableKey) || authBypass,
  }
}

export const env = readEnv()
