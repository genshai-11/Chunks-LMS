#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const bundleDir = path.join(root, 'supabase', 'seeds', 'green-test-49q')
const tasksPath = path.join(bundleDir, 'GREEN-TEST-49Q.audio-tasks.json')
const audioDir = path.join(bundleDir, 'audio')
const bundle = JSON.parse(await fs.readFile(tasksPath, 'utf8'))
const only = process.env.UPLOAD_ONLY ? new Set(process.env.UPLOAD_ONLY.split(',').map((s) => s.trim()).filter(Boolean)) : null
const tasks = only ? bundle.tasks.filter((t) => only.has(t.key)) : bundle.tasks
let uploaded = 0
for (const task of tasks) {
  const src = path.join(audioDir, `${task.key}.wav`)
  await fs.access(src)
  const dst = `ss:///narration-audio/${task.storagePath}`
  console.log(`${task.key} -> ${dst}`)
  const res = spawnSync('supabase', ['--experimental', 'storage', 'cp', '--linked', '--content-type', 'audio/wav', src, dst], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (res.status !== 0) process.exit(res.status ?? 1)
  uploaded++
}
console.log(JSON.stringify({ uploaded, expected: tasks.length }, null, 2))
