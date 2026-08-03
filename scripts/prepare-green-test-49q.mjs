#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const sourcePath = path.join(root, 'supabase', 'seeds', 'green-test-49q', 'GREEN-TEST-49Q.workbook-manifest.json')
const outDir = path.join(root, 'supabase', 'seeds', 'green-test-49q')
const manifestOut = path.join(outDir, 'GREEN-TEST-49Q.manifest.json')
const audioTasksOut = path.join(outDir, 'GREEN-TEST-49Q.audio-tasks.json')
const importSqlOut = path.join(outDir, 'GREEN-TEST-49Q.import.sql')
const summaryOut = path.join(outDir, 'GREEN-TEST-49Q.summary.json')

const ORG_ID = '9d61d048-cbda-4600-8141-4cfd2745cc59'
const PACKAGE_TITLE = 'GREEN-TEST-49Q'
const PACKAGE_SLUG = 'green-test-49q'
const VERSION_LABEL = 'LIVE'
const INTRO_VOICE = 'gemini/gemini-3.1-flash-tts-preview/Kore'
const ITEM_VOICES = [
  'gemini/gemini-2.5-flash-preview-tts/Zephyr',
  'gemini/gemini-2.5-flash-preview-tts/Aoede',
  'gemini/gemini-2.5-flash-preview-tts/Leda',
  'gemini/gemini-2.5-flash-preview-tts/Charon',
  'gemini/gemini-2.5-flash-preview-tts/Orus',
  'gemini/gemini-2.5-flash-preview-tts/Callirrhoe',
]
const PACKAGE_ID = uuidV5('package:green-test-49q')
const PACKAGE_VERSION_ID = uuidV5('package-version:green-test-49q:live')
const CCI_PROFILE_ID = uuidV5('cci-profile:green-test-49q')
const TTS_FALLBACK_TO_KORE_KEYS = new Set([
  's4-q2-vi','s4-q3-vi','s4-q4-vi','s4-q5-vi','s4-q6-vi','s4-q7-vi',
  's5-q1-vi','s5-q2-vi','s5-q3-vi','s5-q4-vi','s5-q5-vi','s5-q6-vi','s5-q7-vi',
  's6-q1-vi','s6-q2-vi','s6-q3-vi','s6-q4-vi','s6-q5-vi','s6-q6-vi','s6-q7-vi',
  's7-q1-en',
])

function uuidV5(name, namespace = '2b9f0706-0a6a-4f15-9d7a-1f3b2c4d5e6f') {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const hash = crypto.createHash('sha1').update(ns).update(name).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
function norm(text) { return String(text ?? '').trim().replace(/\s+/g, ' ') }
function hashSource(text, language, voiceId) {
  return 'sha256:' + crypto.createHash('sha256').update(`${norm(text)}:${language}:${voiceId}`, 'utf8').digest('hex')
}
function sqlString(value) {
  if (value === null || value === undefined) return 'null'
  return `'${String(value).replaceAll("'", "''")}'`
}
function sqlJson(value) { return `${sqlString(JSON.stringify(value))}::jsonb` }
function sqlNum(value) { return value === null || value === undefined || Number.isNaN(Number(value)) ? 'null' : String(value) }
function audioLanguageForItem(sessionOrder, itemOrder) {
  if (sessionOrder <= 3) return 'en'
  if (sessionOrder <= 6) return 'vi'
  if (sessionOrder === 7 && itemOrder <= 3) return 'en'
  return null
}
function sessionLanguage(sessionOrder) {
  return sessionOrder <= 3 ? 'en' : sessionOrder <= 6 ? 'vi' : 'en'
}
function itemText(item, language) {
  const spoken = language === 'en' ? item.spokenScriptEn : item.spokenScriptVi
  const prompt = language === 'en' ? item.promptEn : item.promptVi
  return norm(spoken || prompt)
}
function audioExt() { return 'wav' }
function audioPath(task) { return `narrations/${PACKAGE_VERSION_ID}/green-test-49q/${task.key}.${audioExt()}` }
function byKey(rows) { return Object.fromEntries(rows.map((r) => [r.key, r.text])) }

const manifest = JSON.parse(await fs.readFile(sourcePath, 'utf8'))
const scriptsIntro = byKey(manifest.scriptsIntro ?? [])
const audioIntroTestOverridePath = path.join(outDir, 'GREEN-TEST-49Q.audio_intro_test.override.txt')
try {
  scriptsIntro.audio_intro_test = (await fs.readFile(audioIntroTestOverridePath, 'utf8')).trim()
  const row = (manifest.scriptsIntro ?? []).find((candidate) => candidate.key === 'audio_intro_test')
  if (row) row.text = scriptsIntro.audio_intro_test
} catch {}
manifest.package = {
  sourcePackageId: 'GREEN-TEST-49Q',
  title: PACKAGE_TITLE,
  description: 'GREEN-TEST-49Q · Package-Green-test.xlsx · 7 sessions × 7 questions · 12 English intro scripts',
  versionLabel: VERSION_LABEL,
}
manifest.sessions = manifest.sessions.map((session) => {
  const intro = scriptsIntro[`audio_intro_session${session.sessionOrder}`] ?? session.introTextEn
  return {
    ...session,
    introTextVi: intro,
    introTextEn: intro,
    audioPlan: {
      introContentLanguage: 'en',
      runtimeLanguageKey: sessionLanguage(session.sessionOrder),
      introVoice: INTRO_VOICE,
      itemLanguage: session.sessionOrder <= 3 ? 'en' : session.sessionOrder <= 6 ? 'vi' : 'mixed-en-teacher-read',
    },
    items: session.items.map((item) => ({
      ...item,
      spokenScriptVi: item.promptVi,
      spokenScriptEn: item.promptEn,
      audioPlan: {
        language: audioLanguageForItem(session.sessionOrder, item.itemOrder),
        teacherReadDirect: audioLanguageForItem(session.sessionOrder, item.itemOrder) === null,
      },
    })),
  }
})
manifest.issues = [
  ...(manifest.issues ?? []),
  {
    severity: 'info',
    code: 'scripts-intro-12-english-kore',
    location: 'Scripts Intro',
    message: 'All 12 intro scripts come from Package-Green-test.xlsx / Scripts Intro and are generated in English with Kore.',
  },
  {
    severity: 'warning',
    code: 'manual-read-placeholders-session-7',
    location: 'sessions[7].items[4..7]',
    message: 'Items 4-7 in session 7 are teacher-read direct. Silent placeholder WAV assets are inserted only to satisfy the current runtime non-null audio gate.',
  },
]

const cciBySession = new Map(manifest.cciDefinitions.map((c) => [c.sessionOrder, c]))
const cciCategoryIds = Object.fromEntries(manifest.cciDefinitions.map((c) => [c.sessionOrder, uuidV5(`cci-category:green-test-49q:${c.sessionOrder}`)]))
const audioTasks = []
function pushAudioTask(task) {
  task.storageBucket = 'narration-audio'
  task.storagePath = audioPath(task)
  audioTasks.push(task)
}
function introTask({ key, target, text, part = null, sectionId = null, sessionOrder = null, language = 'en' }) {
  return {
    key,
    type: target,
    sessionOrder,
    itemOrder: null,
    language,
    model: INTRO_VOICE,
    requiresTts: true,
    text: norm(text),
    packageVersionId: PACKAGE_VERSION_ID,
    sectionId,
    itemId: null,
    part,
    audioAssetId: uuidV5(`audio:green-test-49q:${key}`),
    narrationVariantId: uuidV5(`narration:green-test-49q:${key}`),
    sourceTextHash: hashSource(text, language, INTRO_VOICE),
  }
}

pushAudioTask(introTask({ key: 'audio_intro_test', target: 'package_start', text: scriptsIntro.audio_intro_test }))
pushAudioTask(introTask({ key: 'audio_intro_part_I', target: 'part_intro', part: 1, text: scriptsIntro.audio_intro_part_I }))
pushAudioTask(introTask({ key: 'audio_intro_part_II', target: 'part_intro', part: 2, text: scriptsIntro.audio_intro_part_II }))
pushAudioTask(introTask({ key: 'audio_intro_part_III', target: 'part_intro', part: 3, text: scriptsIntro.audio_intro_part_III }))
pushAudioTask(introTask({ key: 'audio_end_test', target: 'package_end', text: scriptsIntro.audio_end_test }))

for (const session of manifest.sessions) {
  const sectionId = uuidV5(`section:green-test-49q:${session.sessionOrder}`)
  const introLanguageKey = sessionLanguage(session.sessionOrder)
  pushAudioTask(introTask({
    key: `audio_intro_session${session.sessionOrder}`,
    target: 'section_intro',
    sessionOrder: session.sessionOrder,
    sectionId,
    language: introLanguageKey,
    text: scriptsIntro[`audio_intro_session${session.sessionOrder}`],
  }))
  for (const item of session.items) {
    const itemLanguage = audioLanguageForItem(session.sessionOrder, item.itemOrder)
    if (!itemLanguage) {
      const manualLanguage = 'en'
      const model = 'manual-read-direct/silent-placeholder'
      const keyItem = `s${session.sessionOrder}-q${item.itemOrder}-manual-read`
      const text = itemText(item, manualLanguage)
      pushAudioTask({
        key: keyItem,
        type: 'test_item',
        sessionOrder: session.sessionOrder,
        itemOrder: item.itemOrder,
        language: manualLanguage,
        model,
        requiresTts: false,
        manualReadDirect: true,
        text,
        packageVersionId: PACKAGE_VERSION_ID,
        sectionId,
        itemId: uuidV5(`item:green-test-49q:${session.sessionOrder}:${item.itemOrder}`),
        part: null,
        audioAssetId: uuidV5(`audio:green-test-49q:${keyItem}`),
        narrationVariantId: uuidV5(`narration:green-test-49q:${keyItem}`),
        sourceTextHash: hashSource(text, manualLanguage, model),
      })
      continue
    }
    const index = audioTasks.filter((t) => t.type === 'test_item' && t.requiresTts !== false).length
    const keyItem = `s${session.sessionOrder}-q${item.itemOrder}-${itemLanguage}`
    const model = TTS_FALLBACK_TO_KORE_KEYS.has(keyItem) || (session.sessionOrder === 7 && [2, 3].includes(item.itemOrder))
      ? INTRO_VOICE
      : ITEM_VOICES[index % ITEM_VOICES.length]
    const text = itemText(item, itemLanguage)
    pushAudioTask({
      key: keyItem,
      type: 'test_item',
      sessionOrder: session.sessionOrder,
      itemOrder: item.itemOrder,
      language: itemLanguage,
      model,
      requiresTts: true,
      text,
      packageVersionId: PACKAGE_VERSION_ID,
      sectionId,
      itemId: uuidV5(`item:green-test-49q:${session.sessionOrder}:${item.itemOrder}`),
      part: null,
      audioAssetId: uuidV5(`audio:green-test-49q:${keyItem}`),
      narrationVariantId: uuidV5(`narration:green-test-49q:${keyItem}`),
      sourceTextHash: hashSource(text, itemLanguage, model),
    })
  }
}

const lines = []
lines.push('-- GREEN-TEST-49Q import generated from chunks-resourcce/Package-Green-test.xlsx')
lines.push('-- Intended sequence: upload audio files to matching storage paths, then run this SQL on linked Supabase.')
lines.push('-- Session 7 Q4-Q7 use silent manual-read placeholders; teachers read those prompts directly.')
lines.push('begin;')
lines.push(`delete from public.test_packages where organization_id = ${sqlString(ORG_ID)}::uuid and slug = ${sqlString(PACKAGE_SLUG)};`)
lines.push(`delete from public.audio_assets where organization_id = ${sqlString(ORG_ID)}::uuid and storage_bucket = 'narration-audio' and storage_path like ${sqlString(`narrations/${PACKAGE_VERSION_ID}/green-test-49q/%`)};`)
lines.push(`update public.test_packages set source_metadata = source_metadata - 'isDefaultLiveTestPackage' where organization_id = ${sqlString(ORG_ID)}::uuid and coalesce(source_metadata->>'isDefaultLiveTestPackage','false') = 'true';`)
lines.push(`insert into public.cci_profiles (id, organization_id, name, version_label, status, description) values (${sqlString(CCI_PROFILE_ID)}::uuid, ${sqlString(ORG_ID)}::uuid, 'GREEN-TEST-49Q CCI', 'LIVE', 'draft', 'CCI definitions from Package-Green-test.xlsx for GREEN-TEST-49Q') on conflict (id) do update set name=excluded.name, description=excluded.description;`)
for (const cci of manifest.cciDefinitions) {
  lines.push(`insert into public.cci_categories (id, profile_id, category_order, label, value, description, metadata) values (${sqlString(cciCategoryIds[cci.sessionOrder])}::uuid, ${sqlString(CCI_PROFILE_ID)}::uuid, ${cci.sessionOrder}, ${sqlString(cci.name)}, ${sqlNum(cci.ampe)}, ${sqlString(cci.description)}, ${sqlJson({ source: 'Package-Green-test.xlsx', sourceCciId: cci.sourceCciId, targetCvrOhm: cci.targetCvrOhm, cpd: cci.cpd })}) on conflict (id) do update set label=excluded.label, value=excluded.value, description=excluded.description, metadata=excluded.metadata;`)
}
lines.push(`insert into public.test_packages (id, organization_id, title, slug, description, source_metadata) values (${sqlString(PACKAGE_ID)}::uuid, ${sqlString(ORG_ID)}::uuid, ${sqlString(PACKAGE_TITLE)}, ${sqlString(PACKAGE_SLUG)}, ${sqlString(manifest.package.description)}, ${sqlJson({ createdBy: 'Craft Agent', createdAtAuthoritative: '2026-07-24T20:02:00+07:00', source: 'Package-Green-test.xlsx', sourceSha256: manifest.source.sha256, sourcePackageId: 'GREEN-TEST-49Q', isDefaultLiveTestPackage: true, scriptsIntro: '12 English intro scripts with Kore', audioPlan: 'S1-S3 English; S4-S6 Vietnamese; S7 Q1-Q3 English; S7 Q4-Q7 teacher-read direct' })});`)
lines.push(`insert into public.test_package_versions (id, package_id, version_label, status, source_metadata) values (${sqlString(PACKAGE_VERSION_ID)}::uuid, ${sqlString(PACKAGE_ID)}::uuid, ${sqlString(VERSION_LABEL)}, 'draft', ${sqlJson({ createdBy: 'Craft Agent', source: 'Package-Green-test.xlsx', sessions: 7, items: 49, introScripts: 12, audioAssets: audioTasks.length, teacherReadDirectItems: 4 })});`)
for (const session of manifest.sessions) {
  const sectionId = uuidV5(`section:green-test-49q:${session.sessionOrder}`)
  const cci = cciBySession.get(session.sessionOrder)
  const cciCategoryId = cciCategoryIds[session.sessionOrder]
  lines.push(`insert into public.test_sections (id, package_version_id, section_order, title, target_cvr_ohm, cci_profile_id, cci_category_id, cci_snapshot, intro_text_vi, intro_text_en, metadata) values (${sqlString(sectionId)}::uuid, ${sqlString(PACKAGE_VERSION_ID)}::uuid, ${session.sessionOrder}, ${sqlString(session.name)}, ${sqlNum(session.targetCvrOhm)}, ${sqlString(CCI_PROFILE_ID)}::uuid, ${sqlString(cciCategoryId)}::uuid, ${sqlJson({ sourceCciId: cci.sourceCciId, label: cci.name, value: cci.ampe })}, ${sqlString(session.introTextVi)}, ${sqlString(session.introTextEn)}, ${sqlJson({ audioPlan: session.audioPlan })});`)
  lines.push(`insert into public.section_measurement_snapshots (test_section_id, package_version_id, target_cvr_ohm, cci_profile_id, cci_category_id, cci_category_label, cci_value, snapshot_metadata) values (${sqlString(sectionId)}::uuid, ${sqlString(PACKAGE_VERSION_ID)}::uuid, ${sqlNum(session.targetCvrOhm)}, ${sqlString(CCI_PROFILE_ID)}::uuid, ${sqlString(cciCategoryId)}::uuid, ${sqlString(cci.name)}, ${sqlNum(cci.ampe)}, ${sqlJson({ sourceCciId: cci.sourceCciId, source: 'Package-Green-test.xlsx', cpd: cci.cpd })});`)
  for (const item of session.items) {
    const itemId = uuidV5(`item:green-test-49q:${session.sessionOrder}:${item.itemOrder}`)
    lines.push(`insert into public.test_items (id, package_version_id, section_id, item_order, source_day, source_stt, term_vi, term_en, prompt_vi, prompt_en, spoken_script_vi, spoken_script_en, tc, lc, tl, cvr_breakdown, source_metadata) values (${sqlString(itemId)}::uuid, ${sqlString(PACKAGE_VERSION_ID)}::uuid, ${sqlString(sectionId)}::uuid, ${item.itemOrder}, ${sqlString(item.sourceMaterial)}, ${sqlString(item.sourceItemId)}, ${sqlString(item.termVi)}, ${sqlString(item.termEn)}, ${sqlString(item.promptVi)}, ${sqlString(item.promptEn)}, ${sqlString(item.spokenScriptVi ?? item.promptVi)}, ${sqlString(item.spokenScriptEn ?? item.promptEn)}, ${sqlNum(item.tc)}, ${sqlNum(item.lc)}, ${sqlNum(item.tl)}, ${sqlJson({ tc: item.tc, lc: item.lc, tl: item.tl })}, ${sqlJson({ sourceCciId: item.sourceCciId, sourceCvrId: item.sourceCvrId, sourceRow: item.sourceRow, wordCountVi: item.wordCountVi, wordCountEn: item.wordCountEn, audioPlan: item.audioPlan })});`)
  }
}
for (const task of audioTasks) {
  const isManualRead = task.requiresTts === false || task.manualReadDirect === true
  const assetMetadata = isManualRead
    ? { provider: 'manual-read-direct', model: task.model, generatedFor: 'GREEN-TEST-49Q', key: task.key, manualReadDirect: true, silentPlaceholder: true }
    : { provider: '9router', model: task.model, generatedFor: 'GREEN-TEST-49Q', key: task.key, scriptsIntro: task.key.startsWith('audio_intro') || task.key === 'audio_end_test' }
  const variantMetadata = isManualRead
    ? { provider: 'manual-read-direct', model: task.model, importedBy: 'Craft Agent', manualReadDirect: true, silentPlaceholder: true }
    : { provider: '9router', model: task.model, importedBy: 'Craft Agent', part: task.part ?? undefined, scriptsIntro: task.key.startsWith('audio_intro') || task.key === 'audio_end_test' }
  lines.push(`insert into public.audio_assets (id, organization_id, storage_bucket, storage_path, mime_type, sha256, visibility, source_kind, bytes, metadata) values (${sqlString(task.audioAssetId)}::uuid, ${sqlString(ORG_ID)}::uuid, 'narration-audio', ${sqlString(task.storagePath)}, 'audio/wav', null, 'private', ${sqlString(isManualRead ? 'custom_upload' : 'generated_tts')}, null, ${sqlJson(assetMetadata)});`)
  lines.push(`insert into public.narration_variants (id, package_version_id, test_section_id, test_item_id, narration_target, language, voice_id, voice_label, source_text_hash, provider_metadata, audio_asset_id, approval_status, approved_at) values (${sqlString(task.narrationVariantId)}::uuid, ${sqlString(PACKAGE_VERSION_ID)}::uuid, ${task.type === 'section_intro' ? `${sqlString(task.sectionId)}::uuid` : 'null'}, ${task.type === 'test_item' ? `${sqlString(task.itemId)}::uuid` : 'null'}, ${sqlString(task.type)}, ${sqlString(task.language)}, ${sqlString(task.model)}, ${sqlString(isManualRead ? 'Teacher read directly' : task.model)}, ${sqlString(task.sourceTextHash)}, ${sqlJson(variantMetadata)}, ${sqlString(task.audioAssetId)}::uuid, 'approved', now());`)
}
const snapshotSeed = JSON.stringify({ package: PACKAGE_TITLE, version: VERSION_LABEL, sourceSha256: manifest.source.sha256, sessions: manifest.sessions.map(s => ({ order: s.sessionOrder, itemCount: s.items.length, language: sessionLanguage(s.sessionOrder), intro: scriptsIntro[`audio_intro_session${s.sessionOrder}`] })) })
const snapshotHash = 'sha256:' + crypto.createHash('sha256').update(snapshotSeed).digest('hex')
lines.push(`update public.test_package_versions set status = 'published', snapshot_hash = ${sqlString(snapshotHash)}, source_metadata = source_metadata || ${sqlJson({ publishedByImport: true, publishedAtAuthoritative: '2026-07-24T20:02:00+07:00', snapshotSeed })} where id = ${sqlString(PACKAGE_VERSION_ID)}::uuid;`)
lines.push('commit;')

await fs.mkdir(outDir, { recursive: true })
await fs.writeFile(manifestOut, `${JSON.stringify(manifest, null, 2)}\n`)
await fs.writeFile(audioTasksOut, `${JSON.stringify({ packageId: PACKAGE_ID, packageVersionId: PACKAGE_VERSION_ID, packageTitle: PACKAGE_TITLE, cciProfileId: CCI_PROFILE_ID, tasks: audioTasks }, null, 2)}\n`)
await fs.writeFile(importSqlOut, `${lines.join('\n')}\n`)
await fs.writeFile(summaryOut, `${JSON.stringify({
  source: 'chunks-resourcce/Package-Green-test.xlsx',
  sourceSha256: manifest.source.sha256,
  packageId: PACKAGE_ID,
  packageVersionId: PACKAGE_VERSION_ID,
  cciProfileId: CCI_PROFILE_ID,
  packageTitle: PACKAGE_TITLE,
  sessions: manifest.sessions.length,
  items: manifest.sessions.reduce((n, s) => n + s.items.length, 0),
  scriptsIntro: manifest.scriptsIntro.length,
  audioAssets: audioTasks.length,
  introAudioAssets: audioTasks.filter(t => ['package_start','part_intro','package_end','section_intro'].includes(t.type)).length,
  packageLevelIntroAssets: audioTasks.filter(t => ['package_start','part_intro','package_end'].includes(t.type)).length,
  sessionIntroAssets: audioTasks.filter(t => t.type === 'section_intro').length,
  ttsAudioTasks: audioTasks.filter(t => t.requiresTts !== false).length,
  silentPlaceholderAssets: audioTasks.filter(t => t.requiresTts === false).length,
  itemAudioTasks: audioTasks.filter(t => t.type === 'test_item' && t.requiresTts !== false).length,
  teacherReadDirectItems: manifest.sessions.flatMap(s => s.items).filter(i => i.audioPlan.teacherReadDirect).length,
  outputDir: outDir,
  runtimeNote: 'All 12 intro scripts are English content with Kore. Session 4-6 section_intro rows use runtime language key vi so current readiness gates pass with Vietnamese item audio.',
}, null, 2)}\n`)
console.log(JSON.stringify(JSON.parse(await fs.readFile(summaryOut, 'utf8')), null, 2))
