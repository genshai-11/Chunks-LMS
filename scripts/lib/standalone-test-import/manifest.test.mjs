import test from 'node:test'
import assert from 'node:assert/strict'
import { manifestSha256, previewSql, stableJson, summary } from './manifest.mjs'

const manifest = {
  source: { filename: 'Chunks Resource.xlsx', sha256: 'a'.repeat(64), sheets: ['Chunks-resource - CVR_new','Package-test','CCI'] },
  package: { sourcePackageId: 'Pre-test', title: 'Pre-test', description: 'Test', versionLabel: 'draft-v1' },
  cciDefinitions: [{ sessionOrder: 1, sourceCciId: 'cci-001', name: 'Give it a shot', ampe: 2, description: 'D', category: 'Blow' }],
  sessions: [{ sessionOrder: 1, name: 'Test 01', description: 'D', sourceCciId: 'cci-001', targetCvrOhm: 3, introTextVi: 'Intro', introTextEn: 'Intro', items: Array.from({ length: 10 }, (_, index) => ({ itemOrder: index + 1 })) }],
  issues: [],
}

test('stable manifest hash ignores object insertion order', () => {
  assert.equal(stableJson({ b: 2, a: 1 }), stableJson({ a: 1, b: 2 }))
  assert.equal(manifestSha256(manifest), manifestSha256(structuredClone(manifest)))
})

test('summary derives item CPD from session CVR and CCI Ampe', () => {
  const result = summary(manifest)
  assert.equal(result.items, 10)
  assert.equal(result.measurements[0].cpd, 6)
})

test('generated SQL is preview-only', () => {
  const sql = previewSql(manifest)
  assert.match(sql, /preview_test_catalog_replacement/)
  assert.doesNotMatch(sql, /apply_test_catalog_replacement/)
  assert.match(sql, /preview only/i)
})
