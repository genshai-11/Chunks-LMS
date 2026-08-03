#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const tasksPath = path.join(root, 'supabase', 'seeds', 'green-test-49q', 'GREEN-TEST-49Q.audio-tasks.json')
const audioDir = path.join(root, 'supabase', 'seeds', 'green-test-49q', 'audio')
const reportPath = path.join(root, 'supabase', 'seeds', 'green-test-49q', 'GREEN-TEST-49Q.tts-report.json')
const baseUrl = (process.env.NINEROUTER_URL || 'https://rbkqhml.abc-tunnel.us').replace(/\/$/, '')
const key = process.env.NINEROUTER_KEY
if (!key) throw new Error('NINEROUTER_KEY is required in env')
const concurrency = Number(process.env.TTS_CONCURRENCY || 3)
const only = process.env.TTS_ONLY ? new Set(process.env.TTS_ONLY.split(',').map((s) => s.trim()).filter(Boolean)) : null

const bundle = JSON.parse(await fs.readFile(tasksPath, 'utf8'))
const tasks = only ? bundle.tasks.filter((t) => only.has(t.key)) : bundle.tasks
await fs.mkdir(audioDir, { recursive: true })

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function sha256Hex(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex') }
function silentWav(durationMs = 350, sampleRate = 24000) {
  const samples = Math.max(1, Math.floor(sampleRate * durationMs / 1000))
  const dataSize = samples * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
}
function extFor(format, contentType) {
  const f = String(format || '').toLowerCase()
  if (f.includes('wav') || String(contentType).includes('wav')) return 'wav'
  if (f.includes('mpeg') || f.includes('mp3') || String(contentType).includes('mpeg')) return 'mp3'
  return f || 'audio'
}
async function generate(task) {
  const target = path.join(audioDir, `${task.key}.wav`)
  if (process.env.FORCE_TTS !== '1') {
    try {
      const existing = await fs.readFile(target)
      if (existing.byteLength > 44) return { ...task, status: 'skipped_existing', file: target, bytes: existing.byteLength, sha256: `sha256:${sha256Hex(existing)}` }
    } catch {}
  }
  if (task.requiresTts === false) {
    const bytes = silentWav()
    await fs.writeFile(target, bytes)
    return { ...task, status: 'generated_silent_placeholder', file: target, bytes: bytes.byteLength, sha256: `sha256:${sha256Hex(bytes)}`, responseFormat: 'wav' }
  }
  const modelParts = String(task.model).split('/')
  const payload = modelParts.length >= 3 && modelParts[0] === 'gemini'
    ? { model: `${modelParts[0]}/${modelParts[1]}`, voice: modelParts.slice(2).join('/'), input: task.text }
    : { model: task.model, input: task.text }
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/v1/audio/speech?response_format=json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'User-Agent': 'CraftAgent/1.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
      }
      const ct = res.headers.get('content-type') || ''
      const json = await res.json()
      if (!json.audio) throw new Error(`Missing audio in response: ${JSON.stringify(json).slice(0, 300)}`)
      const bytes = Buffer.from(json.audio, 'base64')
      const ext = extFor(json.format, ct)
      const out = path.join(audioDir, `${task.key}.${ext === 'mp3' ? 'mp3' : 'wav'}`)
      await fs.writeFile(out, bytes)
      return { ...task, status: 'generated', file: out, bytes: bytes.byteLength, sha256: `sha256:${sha256Hex(bytes)}`, responseFormat: json.format ?? null }
    } catch (err) {
      lastErr = err
      await sleep(1000 * attempt)
    }
  }
  return { ...task, status: 'failed', error: lastErr?.message || String(lastErr) }
}

const results = []
let index = 0
async function worker(workerId) {
  while (index < tasks.length) {
    const task = tasks[index++]
    process.stdout.write(`[${results.length + 1}/${tasks.length}] ${task.key} ${task.model}\n`)
    const result = await generate(task)
    results.push(result)
    await fs.writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), total: tasks.length, results }, null, 2)}\n`)
    if (result.status === 'failed') process.stdout.write(`FAILED ${task.key}: ${result.error}\n`)
  }
}
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, (_, i) => worker(i + 1)))
const summary = {
  total: tasks.length,
  generated: results.filter((r) => r.status === 'generated').length,
  generatedSilentPlaceholders: results.filter((r) => r.status === 'generated_silent_placeholder').length,
  skippedExisting: results.filter((r) => r.status === 'skipped_existing').length,
  failed: results.filter((r) => r.status === 'failed').length,
  audioDir,
  reportPath,
}
await fs.writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
if (summary.failed) process.exit(1)
