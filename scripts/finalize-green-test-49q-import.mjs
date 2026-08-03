#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const bundleDir = path.join(root, 'supabase', 'seeds', 'green-test-49q')
const tasksPath = path.join(bundleDir, 'GREEN-TEST-49Q.audio-tasks.json')
const baseSqlPath = path.join(bundleDir, 'GREEN-TEST-49Q.import.sql')
const finalSqlPath = path.join(bundleDir, 'GREEN-TEST-49Q.import.final.sql')
const finalReportPath = path.join(bundleDir, 'GREEN-TEST-49Q.final-report.json')
const audioDir = path.join(bundleDir, 'audio')

function sha256Hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex') }
function sqlString(value) { return `'${String(value).replaceAll("'", "''")}'` }
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

const bundle = JSON.parse(await fs.readFile(tasksPath, 'utf8'))
let sql = await fs.readFile(baseSqlPath, 'utf8')
const assets = []
const missing = []
for (const task of bundle.tasks) {
  const file = path.join(audioDir, `${task.key}.wav`)
  try {
    const bytes = await fs.readFile(file)
    const sha = `sha256:${sha256Hex(bytes)}`
    assets.push({ key: task.key, storagePath: task.storagePath, file, bytes: bytes.byteLength, sha256: sha })
    const pattern = new RegExp(`(insert into public\\.audio_assets \\(id, organization_id, storage_bucket, storage_path, mime_type, sha256, visibility, source_kind, bytes, metadata\\) values \\('[^']+'::uuid, '[^']+'::uuid, 'narration-audio', '${escapeRegex(task.storagePath)}', 'audio/wav', )null(, 'private', 'generated_tts', )null(, )`)
    sql = sql.replace(pattern, `$1${sqlString(sha)}$2${bytes.byteLength}$3`)
  } catch {
    missing.push({ key: task.key, file })
  }
}
await fs.writeFile(finalSqlPath, sql)
const report = {
  packageTitle: bundle.packageTitle,
  packageId: bundle.packageId,
  packageVersionId: bundle.packageVersionId,
  expectedAudioFiles: bundle.tasks.length,
  foundAudioFiles: assets.length,
  missingAudioFiles: missing.length,
  totalBytes: assets.reduce((n, a) => n + a.bytes, 0),
  finalSqlPath,
  assets,
  missing,
}
await fs.writeFile(finalReportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, assets: undefined }, null, 2))
if (missing.length) process.exit(1)
