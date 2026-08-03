#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const sqlPath = path.join('supabase', 'seeds', 'green-test-49q', 'GREEN-TEST-49Q.import.final.sql')
const res = spawnSync('supabase', ['db', 'query', '--linked', '-f', sqlPath], { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(res.status ?? 1)
