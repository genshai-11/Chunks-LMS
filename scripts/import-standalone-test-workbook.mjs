#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { readCanonicalWorkbook, hasErrors } from './lib/standalone-test-import/workbook.mjs'
import { previewSql, summary } from './lib/standalone-test-import/manifest.mjs'

function value(name, fallback = null) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  return process.argv[index + 1] && !process.argv[index + 1].startsWith('--') ? process.argv[index + 1] : true
}

const root = process.cwd()
const xlsx = path.resolve(String(value('--xlsx', path.join(root, 'chunks-resourcce', 'Chunks Resource.xlsx'))))
const jsonOut = value('--json-out')
const sqlOut = value('--sql-out')
const applyRequested = process.argv.includes('--apply')

if (applyRequested) {
  console.error('Apply is intentionally disabled. Review preview counts/SQL and use the separately approved database RPC path.')
  process.exit(2)
}

const manifest = await readCanonicalWorkbook(xlsx)
const result = summary(manifest)
console.log(JSON.stringify(result, null, 2))
for (const issue of manifest.issues) console.log(`${issue.severity.toUpperCase()} ${issue.code} ${issue.location}: ${issue.message}`)

if (jsonOut) {
  const target = path.resolve(String(jsonOut))
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`)
}
if (sqlOut) {
  const target = path.resolve(String(sqlOut))
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, previewSql(manifest))
}

if (hasErrors(manifest)) process.exit(1)
