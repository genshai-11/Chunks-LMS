import { parseLiveTestExternalRef, liveTestExternalRef } from '../assessment/live-test'

export type LegacyLiveTestResource = {
  id: string
  organizationId: string | null
  title: string
  version: string
  status: 'draft' | 'active' | 'archived'
  sourceFilename: string | null
}

export type LegacyLiveTestBlock = {
  id: string
  resourceId: string
  blockNumber: number
  title: string | null
  cciAvg?: number | null
  cvrAvg?: number | null
  introTextVi?: string | null
  introTextEn?: string | null
}

export type LegacyLiveTestItem = {
  id: string
  blockId: string
  itemNumber: number
  sourceDay: string | null
  sourceStt: string | null
  unitOhm: number | null
  cciValue: number | null
  termVi: string | null
  termEn: string | null
  promptVi: string | null
  promptEn: string | null
  tc: number | null
  lc: number | null
  tl: number | null
  cvrValue: number | null
  cvrBreakdown?: { tc?: number | null; lc?: number | null; tl?: number | null } | null
}

export type LegacyLearningSession = {
  id: string
  sessionFormat: 'lesson' | 'test'
  liveTestResourceId: string | null
  liveTestBlockId: string | null
  testPackageVersionId?: string | null
  testSectionId?: string | null
  sectionMeasurementSnapshotId?: string | null
}

export type LegacySessionQuestion = {
  id: string
  learningSessionId: string
  sequenceNumber: number
  externalRef: string | null
}

export type LegacyUserMapping = {
  id: string
  email: string | null
  authUserId: string | null
  clerkUserId: string | null
  legacyClerkUserId: string | null
  role: 'admin' | 'teacher' | 'learner' | null
  accountStatus?: 'active' | 'inactive'
}

export type LearnerAccessTokenSample = {
  id: string
  tokenHash: string | null
  learnerUserId: string
  classId: string | null
  expiresAt: string
  revokedAt: string | null
}

export type LifecycleTableCounts = {
  learningSessions: number
  sessionQuestions: number
  assessmentAttempts: number
  assessmentEvents: number
  assessmentAttemptSnapshots: number
  finalResults?: number
  corrections?: number
}

export type LiveTestV2MigrationInput = {
  sourceFilename: string
  csvText?: string
  resources: LegacyLiveTestResource[]
  blocks: LegacyLiveTestBlock[]
  items: LegacyLiveTestItem[]
  learningSessions: LegacyLearningSession[]
  sessionQuestions: LegacySessionQuestion[]
  users: LegacyUserMapping[]
  learnerAccessTokens?: LearnerAccessTokenSample[]
  lifecycleCounts: LifecycleTableCounts
}

type CsvRow = Record<string, string>

export type MigrationAnomaly = {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  ref?: string
}

export type TargetSectionPreview = {
  legacyBlockId: string
  sectionId: string
  packageVersionId: string
  sectionOrder: number
  targetCvrOhm: number | null
  cciCategoryId: string | null
  cciValue: number | null
  sourceItemCount: number
  targetItemCount: number
}

export type TargetItemPreview = {
  legacyItemId: string
  itemId: string
  sectionId: string
  packageVersionId: string
  itemOrder: number
  measuredCvr: number | null
  storedLegacyCvr: number | null
  targetCvrOhm: number | null
  v2ItemCpd: number | null
  legacyCpd: number | null
}

export type ExternalRefMappingPreview = {
  sessionQuestionId: string
  legacyExternalRef: string
  legacyItemId: string
  v2ExternalRef: string | null
  resolution: 'resolved' | 'unresolved' | 'already-versioned'
}

export type LiveTestV2MigrationPreview = {
  generatedAt: string
  sourceFilename: string
  localOnly: true
  remoteMutation: false
  deterministicChecksum: string
  counts: {
    csvRows: number
    legacyResources: number
    legacyBlocks: number
    legacyItems: number
    targetPackages: number
    targetPackageVersions: number
    targetSections: number
    targetItems: number
    cciCategories: number
    liveTestSessions: number
    liveTestExternalRefs: number
    resolvedExternalRefs: number
    unresolvedExternalRefs: number
  }
  cciProfileSeed: {
    profileKey: string
    categoryValues: Array<{ categoryId: string; label: string; value: number }>
  }
  targetSections: TargetSectionPreview[]
  targetItems: TargetItemPreview[]
  externalRefMappings: ExternalRefMappingPreview[]
  historyGuard: {
    noRewriteTables: string[]
    lifecycleCountsBefore: LifecycleTableCounts
    lifecycleCountsAfterDryRun: LifecycleTableCounts
    checksumBefore: string
    checksumAfterDryRun: string
  }
  compatibility: {
    staffWithLegacyClerkRefs: number
    staffWithSupabaseAuthLinks: number
    learnersWithoutAuthAccounts: number
    learnerTokenSamples: number
    rawLearnerTokensPersisted: number
  }
  rollbackReadiness: {
    restorePointRequired: true
    rollbackNotes: string[]
  }
  anomalies: MigrationAnomaly[]
}

const LIFECYCLE_TABLES = [
  'learning_sessions',
  'session_questions',
  'assessment_attempts',
  'assessment_events',
  'assessment_attempt_snapshots',
  'final_results',
  'corrections',
]

function clean(value: string): string {
  return value.replace(/^\uFEFF/, '').trim()
}

export function parseCsvRows(text: string): CsvRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
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
  const [headers, ...data] = rows.filter((candidate) => candidate.some((entry) => clean(entry) !== ''))
  if (!headers) return []
  const normalizedHeaders = headers.map(clean)
  return data.map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ''])))
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function round2(value: number | null): number | null {
  if (value == null) return null
  return Math.round(value * 100) / 100
}

function stableHash(value: unknown): string {
  const text = JSON.stringify(value)
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function stableId(prefix: string, ...parts: Array<string | number | null>): string {
  return `${prefix}-${stableHash(parts)}`
}

function stableUuid(...parts: Array<string | number | null>): string {
  const seed = `${stableHash(parts)}${stableHash([...parts, 'a'])}${stableHash([...parts, 'b'])}${stableHash([...parts, 'c'])}`
  return `${seed.slice(0, 8)}-${seed.slice(8, 12)}-${seed.slice(12, 16)}-${seed.slice(16, 20)}-${seed.slice(20, 32)}`
}

function measuredFromItem(item: LegacyLiveTestItem): number | null {
  const tc = item.tc ?? item.cvrBreakdown?.tc ?? null
  const lc = item.lc ?? item.cvrBreakdown?.lc ?? null
  const tl = item.tl ?? item.cvrBreakdown?.tl ?? null
  if (tc == null || lc == null || tl == null) return null
  return round2(tc * lc * tl)
}

function csvSectionTargets(csvRows: CsvRow[]): Map<number, Set<number>> {
  const targets = new Map<number, Set<number>>()
  for (const row of csvRows) {
    const section = num(row['Session No.'])
    const target = num(row['Unit (Ohm)'])
    if (section == null || target == null) continue
    if (!targets.has(section)) targets.set(section, new Set())
    targets.get(section)?.add(target)
  }
  return targets
}

export function previewLiveTestV2Migration(input: LiveTestV2MigrationInput): LiveTestV2MigrationPreview {
  const anomalies: MigrationAnomaly[] = []
  const csvRows = input.csvText ? parseCsvRows(input.csvText) : []
  const csvTargets = csvSectionTargets(csvRows)
  const itemsByBlock = new Map<string, LegacyLiveTestItem[]>()

  for (const item of input.items) {
    const list = itemsByBlock.get(item.blockId) ?? []
    list.push(item)
    itemsByBlock.set(item.blockId, list)
  }

  for (const [sessionNo, targets] of csvTargets) {
    if (targets.size > 1) {
      anomalies.push({
        code: 'csv.section-target-conflict',
        severity: 'error',
        message: `CSV Session No. ${sessionNo} has multiple Unit (Ohm) targets: ${[...targets].join(', ')}`,
        ref: String(sessionNo),
      })
    }
  }

  const cciValues = new Set<number>()
  const targetSections: TargetSectionPreview[] = []
  const targetItems: TargetItemPreview[] = []

  for (const block of [...input.blocks].sort((a, b) => a.blockNumber - b.blockNumber)) {
    const resource = input.resources.find((candidate) => candidate.id === block.resourceId)
    const packageVersionId = stableUuid('live-test-package-version', block.resourceId, resource?.version ?? '1.0.0')
    const sectionId = stableUuid('live-test-section', block.id)
    const blockItems = [...(itemsByBlock.get(block.id) ?? [])].sort((a, b) => a.itemNumber - b.itemNumber)
    const sectionTargets = csvTargets.get(block.blockNumber)
    const targetCvrOhm = sectionTargets?.size === 1 ? [...sectionTargets][0] : blockItems.find((item) => item.unitOhm != null)?.unitOhm ?? null
    const cciValue = blockItems.find((item) => item.cciValue != null)?.cciValue ?? null
    if (cciValue != null) cciValues.add(cciValue)
    if (targetCvrOhm == null) {
      anomalies.push({
        code: 'section.target-cvr-missing',
        severity: 'error',
        message: `Section ${block.blockNumber} has no CSV Unit (Ohm) or legacy unit_ohm target`,
        ref: block.id,
      })
    }
    targetSections.push({
      legacyBlockId: block.id,
      sectionId,
      packageVersionId,
      sectionOrder: block.blockNumber,
      targetCvrOhm,
      cciCategoryId: cciValue == null ? null : stableUuid('cci-category', cciValue),
      cciValue,
      sourceItemCount: blockItems.length,
      targetItemCount: blockItems.length,
    })

    for (const item of blockItems) {
      const measuredCvr = measuredFromItem(item)
      if (measuredCvr != null && item.cvrValue != null && measuredCvr !== round2(item.cvrValue)) {
        anomalies.push({
          code: 'item.measured-cvr-mismatch',
          severity: 'warning',
          message: `Legacy item ${item.id} stored CVR ${item.cvrValue} but TC × LC × TL recalculates to ${measuredCvr}`,
          ref: item.id,
        })
      }
      const v2ItemCpd = targetCvrOhm == null || cciValue == null ? null : round2(targetCvrOhm * cciValue)
      const legacyCpd = item.cvrValue == null || item.cciValue == null ? null : round2(item.cvrValue * item.cciValue)
      if (v2ItemCpd != null && legacyCpd != null && v2ItemCpd !== legacyCpd) {
        anomalies.push({
          code: 'cpd.formula-variance',
          severity: 'info',
          message: `Legacy item ${item.id} V1 CPD ${legacyCpd} differs from V2 section target × CCI CPD ${v2ItemCpd}`,
          ref: item.id,
        })
      }
      targetItems.push({
        legacyItemId: item.id,
        itemId: stableUuid('live-test-item-v2', item.id),
        sectionId,
        packageVersionId,
        itemOrder: item.itemNumber,
        measuredCvr,
        storedLegacyCvr: item.cvrValue,
        targetCvrOhm,
        v2ItemCpd,
        legacyCpd,
      })
    }
  }

  const targetItemsByLegacyId = new Map(targetItems.map((item) => [item.legacyItemId, item]))
  const externalRefMappings: ExternalRefMappingPreview[] = []
  for (const question of input.sessionQuestions) {
    const parsed = parseLiveTestExternalRef(question.externalRef)
    if (!parsed) continue
    if (parsed.packageVersionId) {
      externalRefMappings.push({
        sessionQuestionId: question.id,
        legacyExternalRef: question.externalRef ?? '',
        legacyItemId: parsed.itemId,
        v2ExternalRef: question.externalRef,
        resolution: 'already-versioned',
      })
      continue
    }
    const target = targetItemsByLegacyId.get(parsed.itemId)
    if (!target) {
      anomalies.push({
        code: 'external-ref.unresolved',
        severity: 'error',
        message: `Session Question ${question.id} references legacy item ${parsed.itemId}, which is not present in the migration source`,
        ref: question.id,
      })
    }
    externalRefMappings.push({
      sessionQuestionId: question.id,
      legacyExternalRef: question.externalRef ?? '',
      legacyItemId: parsed.itemId,
      v2ExternalRef: target ? liveTestExternalRef(target.itemId, target.packageVersionId) : null,
      resolution: target ? 'resolved' : 'unresolved',
    })
  }

  const cciProfileSeed = {
    profileKey: stableUuid('cci-profile', input.sourceFilename, 'migrated-csv-default'),
    categoryValues: [...cciValues].sort((a, b) => a - b).map((value) => ({
      categoryId: stableUuid('cci-category', value),
      label: `Migrated CCI ${value}`,
      value,
    })),
  }

  const historyChecksumBasis = {
    counts: input.lifecycleCounts,
    learningSessionIds: input.learningSessions.map((row) => row.id).sort(),
    sessionQuestionIds: input.sessionQuestions.map((row) => row.id).sort(),
  }
  const checksumBefore = stableHash(historyChecksumBasis)
  const rawLearnerTokensPersisted = (input.learnerAccessTokens ?? []).filter((token) => {
    const value = token.tokenHash ?? ''
    return value.length > 0 && !value.includes(':') && value.length < 32
  }).length

  const preview: LiveTestV2MigrationPreview = {
    generatedAt: 'dry-run-deterministic',
    sourceFilename: input.sourceFilename,
    localOnly: true,
    remoteMutation: false,
    deterministicChecksum: stableHash({
      resources: input.resources,
      blocks: input.blocks,
      items: input.items,
      csvRows,
      mappings: externalRefMappings,
      targetItems,
    }),
    counts: {
      csvRows: csvRows.length,
      legacyResources: input.resources.length,
      legacyBlocks: input.blocks.length,
      legacyItems: input.items.length,
      targetPackages: new Set(input.resources.map((resource) => stableUuid('live-test-package', resource.id))).size,
      targetPackageVersions: new Set(input.resources.map((resource) => stableUuid('live-test-package-version', resource.id, resource.version))).size,
      targetSections: targetSections.length,
      targetItems: targetItems.length,
      cciCategories: cciProfileSeed.categoryValues.length,
      liveTestSessions: input.learningSessions.filter((session) => session.sessionFormat === 'test').length,
      liveTestExternalRefs: externalRefMappings.length,
      resolvedExternalRefs: externalRefMappings.filter((mapping) => mapping.resolution !== 'unresolved').length,
      unresolvedExternalRefs: externalRefMappings.filter((mapping) => mapping.resolution === 'unresolved').length,
    },
    cciProfileSeed,
    targetSections,
    targetItems,
    externalRefMappings,
    historyGuard: {
      noRewriteTables: LIFECYCLE_TABLES,
      lifecycleCountsBefore: input.lifecycleCounts,
      lifecycleCountsAfterDryRun: input.lifecycleCounts,
      checksumBefore,
      checksumAfterDryRun: checksumBefore,
    },
    compatibility: {
      staffWithLegacyClerkRefs: input.users.filter((user) => user.role !== 'learner' && (user.legacyClerkUserId || user.clerkUserId)).length,
      staffWithSupabaseAuthLinks: input.users.filter((user) => user.role !== 'learner' && user.authUserId).length,
      learnersWithoutAuthAccounts: input.users.filter((user) => user.role === 'learner' && !user.authUserId).length,
      learnerTokenSamples: input.learnerAccessTokens?.length ?? 0,
      rawLearnerTokensPersisted,
    },
    rollbackReadiness: {
      restorePointRequired: true,
      rollbackNotes: [
        'Capture a hosted database backup or PITR restore point before any production migration approval request.',
        'Keep legacy live_test_resources/live_test_blocks/live_test_items and session_questions.external_ref unchanged through the verification window.',
        'Rollback before cutover is disabling V2 readers and dropping only additive V2 package/mapping rows created by the recorded migration run.',
        'Do not revoke or rewrite legacy Clerk references until Supabase Auth mapping and signed learner-token checks pass.',
      ],
    },
    anomalies,
  }

  return preview
}
