import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildManifest, hasErrors, readCanonicalWorkbook } from './workbook.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const workbook = path.resolve(here, '../../../chunks-resourcce/Chunks Resource.xlsx')

function cloneSheets(manifestLike) {
  return structuredClone(manifestLike)
}

test('canonical workbook maps seven sessions, 49 items, CVR and CCI Ampe correctly', async () => {
  const manifest = await readCanonicalWorkbook(workbook)
  assert.equal(hasErrors(manifest), false)
  assert.equal(manifest.sessions.length, 7)
  assert.equal(manifest.sessions.flatMap((session) => session.items).length, 49)
  assert.deepEqual(manifest.sessions.map((session) => session.targetCvrOhm), [1, 3, 5, 7, 9, 11, 13])
  assert.deepEqual(manifest.cciDefinitions.map((cci) => cci.ampe), [2, 2, 4, 4, 6, 6, 8])
  assert.deepEqual(manifest.cciDefinitions.map((cci) => cci.name), [
    'Give it a shot', 'Go with the flow', 'Chunks on the go', 'Freeze',
    'Robot', 'Taichi', 'Strike',
  ])
  const warnings = manifest.issues.filter((issue) => issue.severity === 'warning')
  assert.equal(warnings.length, 0)
})

test('missing required sheet is a structural error', () => {
  const manifest = buildManifest({ sheets: [], filename: 'missing.xlsx', sha256: '0'.repeat(64) })
  assert.equal(hasErrors(manifest), true)
  assert.ok(manifest.issues.some((issue) => issue.code === 'MISSING_SHEET'))
})

test('duplicate item and blank bilingual prompt are reported', () => {
  const sheets = [
    { sheet: 'Chunks-resource - CVR_new', data: [
      ['Material','Session No.','Item_id','CCI-id','CVR-id','Term (Tiếng Việt)','Term (Tiếng Anh)','Complete Sentence (Vie)','Complete Sentence (Eng)'],
      ['Day','Session 1','Number 1','cci-001',3,'Từ','Word','','Sentence'],
      ['Day','Session 1','Number 1','cci-001',3,'Từ','Word','Câu','Sentence'],
    ] },
    { sheet: 'Package-test', data: [['Package_id','Name','Description','Session list','CCI list'],['Pre-test','Test 01','Desc','session_id -1','cci-id 01']] },
    { sheet: 'CCI', data: [['Session','CCI_id','CCI Name','Ampe (A)','Description','Category'],[1,'cci-001','Name',2,'Desc','Blow']] },
  ]
  const manifest = buildManifest({ sheets: cloneSheets(sheets), filename: 'bad.xlsx', sha256: '0'.repeat(64) })
  assert.ok(manifest.issues.some((issue) => issue.code === 'DUPLICATE_ITEM'))
  assert.ok(manifest.issues.some((issue) => issue.code === 'MISSING_VALUE'))
})
