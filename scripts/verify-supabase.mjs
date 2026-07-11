/**
 * Verify hosted Supabase connectivity using web/.env (anon key only).
 * Usage (from repo root): npm run supabase:verify
 */
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = resolve(root, 'web')
const require = createRequire(resolve(webRoot, 'package.json'))
const { createClient } = require('@supabase/supabase-js')

const envPath = resolve(webRoot, '.env')

function loadEnv(path) {
  if (!existsSync(path)) throw new Error(`Missing ${path}`)
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    // strip BOM
    const clean = t.replace(/^\uFEFF/, '')
    const i = clean.indexOf('=')
    if (i < 0) continue
    out[clean.slice(0, i).trim()] = clean.slice(i + 1).trim()
  }
  return out
}

const env = loadEnv(envPath)
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env')
  process.exit(1)
}

console.log('Project URL:', url)
console.log('Using: VITE_SUPABASE_ANON_KEY (browser-safe). Never put service_role in Vite.')

const sb = createClient(url, key)

const checks = [
  ['organizations', 'id,name'],
  ['courses', 'id,code'],
  ['classes', 'id,name'],
  ['users', 'id,display_name'],
  ['learning_sessions', 'id,status'],
  ['org_settings', 'organization_id'],
]

let failed = false
for (const [table, cols] of checks) {
  const { data, error, status } = await sb.from(table).select(cols).limit(5)
  if (error) {
    failed = true
    console.error(`✗ ${table}:`, error.message)
  } else {
    console.log(`✓ ${table}: HTTP ${status}, rows=${data?.length ?? 0}`)
  }
}

const probeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
const write = await sb.from('organizations').upsert(
  { id: probeId, name: 'Chunks connectivity probe' },
  { onConflict: 'id' },
)
if (write.error) {
  failed = true
  console.error('✗ write probe:', write.error.message)
} else {
  console.log('✓ write probe: organizations upsert OK')
  await sb.from('organizations').delete().eq('id', probeId)
  console.log('✓ cleanup probe row')
}

if (failed) {
  console.error('\nConnection has errors. Check RLS / migrations / keys.')
  process.exit(1)
}
console.log('\nSupabase anon access OK. Sign in (or AUTH_BYPASS locally) and use the app to sync roster.')
