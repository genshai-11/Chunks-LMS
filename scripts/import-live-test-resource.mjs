#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = process.cwd()
const DEFAULT_CSV = path.join(ROOT, 'chunks-resourcce', 'Chunks-resource - CVR_generated.csv')

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return fallback
  const value = process.argv[idx + 1]
  return value && !value.startsWith('--') ? value : true
}

const csvPath = path.resolve(String(arg('--csv', DEFAULT_CSV)))
const title = String(arg('--title', 'CCI CVR Live Test'))
const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply')
const jsonOut = arg('--json-out', null)
const sqlOut = arg('--sql-out', null)
const tts = arg('--tts', 'none')

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }
  const [headers, ...data] = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (!headers) throw new Error('CSV has no header row')
  return data.map((values) => Object.fromEntries(headers.map((h, i) => [h.trim(), values[i] ?? ''])))
}

function num(value) {
  if (value == null || String(value).trim() === '') return null
  const n = Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}

function stableId(...parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16)
}

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100
}

function itemAudioText(item, lang) {
  const prompt = lang === 'en' ? item.prompt_en : item.prompt_vi
  return `Number ${String(item.item_number).padStart(2, '0')}. ${prompt ?? ''}`.trim()
}

function blockIntro(block, lang) {
  const cvrRange = block.cvr_min == null || block.cvr_max == null ? 'CVR pending' : lang === 'vi'
    ? `CVR ${block.cvr_min} đến ${block.cvr_max}`
    : `CVR ${block.cvr_min} to ${block.cvr_max}`
  const cpdRange = block.cpd_min == null || block.cpd_max == null ? 'CPD pending' : lang === 'vi'
    ? `CPD ${block.cpd_min} đến ${block.cpd_max}`
    : `CPD ${block.cpd_min} to ${block.cpd_max}`
  return `Session ${block.block_number}. ${title}. CCI ${block.cci_avg ?? block.cci_min ?? 'pending'}. ${cvrRange}. ${cpdRange}.`
}

function buildResource(rows) {
  const blocks = new Map()
  for (const row of rows) {
    const blockNumber = num(row['Session No.'])
    if (!blockNumber) throw new Error(`Missing Session No. for row ${JSON.stringify(row)}`)
    const itemNumber = (blocks.get(blockNumber)?.items.length ?? 0) + 1
    const cci = num(row['Unit (Ohm)'])
    const cvr = num(row.CVR)
    const item = {
      import_key: stableId(title, blockNumber, itemNumber, row['Tiếng Việt'], row['Tiếng Anh']),
      item_number: itemNumber,
      source_day: row.Session || null,
      source_stt: row.STT || null,
      unit_ohm: cci,
      cci_value: cci,
      cci_measure: 'Unit (Ohm)',
      cci_unit_label: 'CCI',
      cci_source: 'csv:Unit (Ohm)',
      term_vi: row['Tiếng Việt'] || '',
      term_en: row['Tiếng Anh'] || '',
      prompt_vi: row['Complete Sentence (Vie)'] || null,
      prompt_en: row['Complete Sentence (Eng)'] || null,
      tc: num(row.TC),
      lc: num(row.LC),
      tl: num(row.TL),
      cvr_value: cvr,
      cvr_measure: 'Estimated TC × LC × TL',
      cvr_unit_label: 'CVR',
      cvr_breakdown: {
        tc: num(row.TC),
        lc: num(row.LC),
        tl: num(row.TL),
        formula: 'CVR = Estimated TC × LC × TL',
      },
      cpd_value: cvr != null && cci != null ? round2(cvr * cci) : null,
    }
    item.audio_text_vi = itemAudioText(item, 'vi')
    item.audio_text_en = itemAudioText(item, 'en')

    if (!blocks.has(blockNumber)) {
      blocks.set(blockNumber, {
        block_number: blockNumber,
        title: `Session ${blockNumber}`,
        items: [],
      })
    }
    blocks.get(blockNumber).items.push(item)
  }

  const blockList = [...blocks.values()].sort((a, b) => a.block_number - b.block_number)
  for (const block of blockList) {
    block.items.sort((a, b) => a.item_number - b.item_number)
    const ccis = block.items.map((i) => i.cci_value).filter((v) => v != null)
    const cvrs = block.items.map((i) => i.cvr_value).filter((v) => v != null)
    const cpds = block.items.map((i) => i.cpd_value).filter((v) => v != null)
    block.cci_min = ccis.length ? Math.min(...ccis) : null
    block.cci_max = ccis.length ? Math.max(...ccis) : null
    block.cci_avg = ccis.length ? round2(ccis.reduce((s, v) => s + v, 0) / ccis.length) : null
    block.cvr_min = cvrs.length ? Math.min(...cvrs) : null
    block.cvr_max = cvrs.length ? Math.max(...cvrs) : null
    block.cvr_avg = cvrs.length ? round2(cvrs.reduce((s, v) => s + v, 0) / cvrs.length) : null
    block.cpd_min = cpds.length ? Math.min(...cpds) : null
    block.cpd_max = cpds.length ? Math.max(...cpds) : null
    block.cpd_avg = cpds.length ? round2(cpds.reduce((s, v) => s + v, 0) / cpds.length) : null
    block.intro_text_vi = blockIntro(block, 'vi')
    block.intro_text_en = blockIntro(block, 'en')
  }

  return {
    title,
    version: '1.0.0',
    source_filename: path.basename(csvPath),
    tts,
    blocks: blockList,
  }
}

function sqlString(value) {
  if (value == null) return 'null'
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlNumber(value) {
  return value == null ? 'null' : String(value)
}

function sqlJson(value) {
  return value == null ? 'null' : `${sqlString(JSON.stringify(value))}::jsonb`
}

function buildSeedSql(resource) {
  const blockValues = resource.blocks.map((block) => `    (${block.block_number}, ${sqlString(block.title)}, ${sqlString(block.intro_text_vi)}, ${sqlString(block.intro_text_en)}, ${sqlNumber(block.cci_min)}, ${sqlNumber(block.cci_max)}, ${sqlNumber(block.cci_avg)}, ${sqlNumber(block.cvr_min)}, ${sqlNumber(block.cvr_max)}, ${sqlNumber(block.cvr_avg)}, ${sqlNumber(block.cpd_min)}, ${sqlNumber(block.cpd_max)}, ${sqlNumber(block.cpd_avg)})`).join(',\n')
  const itemValues = resource.blocks.flatMap((block) => block.items.map((item) => `    (${block.block_number}, ${item.item_number}, ${sqlString(item.source_day)}, ${sqlString(item.source_stt)}, ${sqlString(item.term_vi)}, ${sqlString(item.term_en)}, ${sqlString(item.prompt_vi)}, ${sqlString(item.prompt_en)}, ${sqlString(item.audio_text_vi)}, ${sqlString(item.audio_text_en)}, ${sqlNumber(item.cci_value)}, ${sqlString(item.cci_measure)}, ${sqlString(item.cci_unit_label)}, ${sqlString(item.cci_source)}, ${sqlNumber(item.cvr_value)}, ${sqlString(item.cvr_measure)}, ${sqlString(item.cvr_unit_label)}, ${sqlJson(item.cvr_breakdown)}, ${sqlNumber(item.cpd_value)}, ${sqlJson({ source: resource.source_filename, import_key: item.import_key, unit_ohm: item.unit_ohm, tc: item.tc, lc: item.lc, tl: item.tl })})`)).join(',\n')
  return `-- Generated by scripts/import-live-test-resource.mjs --sql-out\n-- Resource: ${resource.title} ${resource.version}\n-- Source CSV: ${resource.source_filename}\n-- Safe local seed/upsert: uses the first organization in this database.\n\nbegin;\n\nwith org as (\n  select id from public.organizations order by created_at asc limit 1\n), upsert_resource as (\n  insert into public.live_test_resources (organization_id, title, version, status, source_filename, metadata)\n  select org.id, ${sqlString(resource.title)}, ${sqlString(resource.version)}, 'draft', ${sqlString(resource.source_filename)}, ${sqlJson({ tts: resource.tts, generated_by: 'scripts/import-live-test-resource.mjs' })}\n  from org\n  on conflict (organization_id, title, version) do update set\n    status = excluded.status,\n    source_filename = excluded.source_filename,\n    metadata = excluded.metadata,\n    updated_at = now()\n  returning id\n), block_rows(block_number, title, intro_text_vi, intro_text_en, cci_min, cci_max, cci_avg, cvr_min, cvr_max, cvr_avg, cpd_min, cpd_max, cpd_avg) as (\n  values\n${blockValues}\n)\ninsert into public.live_test_blocks (resource_id, block_number, title, intro_text_vi, intro_text_en, cci_min, cci_max, cci_avg, cvr_min, cvr_max, cvr_avg, cpd_min, cpd_max, cpd_avg)\nselect r.id, b.block_number, b.title, b.intro_text_vi, b.intro_text_en, b.cci_min, b.cci_max, b.cci_avg, b.cvr_min, b.cvr_max, b.cvr_avg, b.cpd_min, b.cpd_max, b.cpd_avg\nfrom upsert_resource r cross join block_rows b\non conflict (resource_id, block_number) do update set\n  title = excluded.title,\n  intro_text_vi = excluded.intro_text_vi,\n  intro_text_en = excluded.intro_text_en,\n  cci_min = excluded.cci_min,\n  cci_max = excluded.cci_max,\n  cci_avg = excluded.cci_avg,\n  cvr_min = excluded.cvr_min,\n  cvr_max = excluded.cvr_max,\n  cvr_avg = excluded.cvr_avg,\n  cpd_min = excluded.cpd_min,\n  cpd_max = excluded.cpd_max,\n  cpd_avg = excluded.cpd_avg;\n\nwith resource as (\n  select id from public.live_test_resources\n  where title = ${sqlString(resource.title)} and version = ${sqlString(resource.version)}\n  order by updated_at desc limit 1\n), item_rows(block_number, item_number, source_day, source_stt, term_vi, term_en, prompt_vi, prompt_en, audio_text_vi, audio_text_en, cci_value, cci_measure, cci_unit_label, cci_source, cvr_value, cvr_measure, cvr_unit_label, cvr_breakdown, cpd_value, metadata) as (\n  values\n${itemValues}\n)\ninsert into public.live_test_items (block_id, item_number, source_day, source_stt, term_vi, term_en, prompt_vi, prompt_en, audio_text_vi, audio_text_en, cci_value, cci_measure, cci_unit_label, cci_source, cvr_value, cvr_measure, cvr_unit_label, cvr_breakdown, cpd_value, metadata)\nselect b.id, i.item_number, i.source_day, i.source_stt, i.term_vi, i.term_en, i.prompt_vi, i.prompt_en, i.audio_text_vi, i.audio_text_en, i.cci_value, i.cci_measure, i.cci_unit_label, i.cci_source, i.cvr_value, i.cvr_measure, i.cvr_unit_label, i.cvr_breakdown, i.cpd_value, i.metadata\nfrom item_rows i\njoin resource r on true\njoin public.live_test_blocks b on b.resource_id = r.id and b.block_number = i.block_number\non conflict (block_id, item_number) do update set\n  source_day = excluded.source_day,\n  source_stt = excluded.source_stt,\n  term_vi = excluded.term_vi,\n  term_en = excluded.term_en,\n  prompt_vi = excluded.prompt_vi,\n  prompt_en = excluded.prompt_en,\n  audio_text_vi = excluded.audio_text_vi,\n  audio_text_en = excluded.audio_text_en,\n  cci_value = excluded.cci_value,\n  cci_measure = excluded.cci_measure,\n  cci_unit_label = excluded.cci_unit_label,\n  cci_source = excluded.cci_source,\n  cvr_value = excluded.cvr_value,\n  cvr_measure = excluded.cvr_measure,\n  cvr_unit_label = excluded.cvr_unit_label,\n  cvr_breakdown = excluded.cvr_breakdown,\n  cpd_value = excluded.cpd_value,\n  metadata = excluded.metadata;\n\ncommit;\n`
}

function validate(resource) {
  const errors = []
  if (resource.blocks.length !== 8) errors.push(`Expected 8 blocks, found ${resource.blocks.length}`)
  for (const block of resource.blocks) {
    if (block.items.length !== 10) errors.push(`Block ${block.block_number}: expected 10 items, found ${block.items.length}`)
    const nums = block.items.map((i) => i.item_number).sort((a, b) => a - b)
    for (let i = 1; i <= 10; i++) if (nums[i - 1] !== i) errors.push(`Block ${block.block_number}: missing item ${i}`)
    for (const item of block.items) {
      if (!item.term_vi || !item.term_en) errors.push(`Block ${block.block_number} item ${item.item_number}: missing term`)
      if (!item.prompt_vi) errors.push(`Block ${block.block_number} item ${item.item_number}: missing Vietnamese prompt`)
      if (!item.prompt_en) errors.push(`Block ${block.block_number} item ${item.item_number}: missing English prompt`)
      if (item.cvr_value == null) errors.push(`Block ${block.block_number} item ${item.item_number}: missing CVR`)
      if (item.cci_value == null) errors.push(`Block ${block.block_number} item ${item.item_number}: missing CCI`)
    }
  }
  return errors
}

const csv = fs.readFileSync(csvPath, 'utf8')
const rows = parseCsv(csv)
const resource = buildResource(rows)
const errors = validate(resource)
const summary = {
  csvPath,
  title,
  dryRun,
  rows: rows.length,
  blocks: resource.blocks.length,
  items: resource.blocks.reduce((s, b) => s + b.items.length, 0),
  incompleteItems: errors.filter((e) => e.includes('missing')).length,
  errors,
  resource,
}

if (jsonOut) fs.writeFileSync(path.resolve(jsonOut), JSON.stringify(summary, null, 2))
if (sqlOut) fs.writeFileSync(path.resolve(String(sqlOut)), buildSeedSql(resource))

console.log(`Live-test resource import ${dryRun ? 'dry-run' : 'apply'}: ${title}`)
console.log(`CSV: ${csvPath}`)
console.log(`Rows: ${summary.rows}; blocks: ${summary.blocks}; items: ${summary.items}`)
if (jsonOut) console.log(`JSON summary: ${path.resolve(String(jsonOut))}`)
if (sqlOut) console.log(`SQL seed: ${path.resolve(String(sqlOut))}`)
if (errors.length) {
  console.log(`Validation issues: ${errors.length}`)
  for (const e of errors.slice(0, 25)) console.log(`- ${e}`)
  if (errors.length > 25) console.log(`... ${errors.length - 25} more`)
} else {
  console.log('Validation passed: resource can be marked active')
}

if (!dryRun) {
  throw new Error('Direct database apply is not implemented in this safe importer. Use --sql-out to generate reviewed seed SQL, then apply it locally/remotely only after approval.')
}
