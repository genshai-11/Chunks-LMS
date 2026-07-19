import { describe, expect, it } from 'vitest'
import {
  parseCsvRows,
  previewLiveTestV2Migration,
  type LiveTestV2MigrationInput,
} from './live-test-v2-migration-preview'

const csv = `Session No.,Session,STT,Tiếng Việt,Tiếng Anh,Complete Sentence (Vie),Complete Sentence (Eng),Unit (Ohm),TC,LC,TL,CVR
1,Day 2,S1,A,A en,Câu A,Sentence A,3,3,1,1,3
1,Day 2,S2,B,B en,Câu B,Sentence B,3,2,2,1,4
2,Day 3,S3,C,C en,Câu C,Sentence C,5,5,1,1,5
`

function baseInput(): LiveTestV2MigrationInput {
  return {
    sourceFilename: 'Chunks-resource - CVR_new.csv',
    csvText: csv,
    resources: [
      {
        id: 'legacy-resource-1',
        organizationId: 'org-1',
        title: 'CCI CVR Live Test',
        version: '1.0.0',
        status: 'active',
        sourceFilename: 'Chunks-resource - CVR_new.csv',
      },
    ],
    blocks: [
      { id: 'legacy-block-1', resourceId: 'legacy-resource-1', blockNumber: 1, title: 'Session 1' },
      { id: 'legacy-block-2', resourceId: 'legacy-resource-1', blockNumber: 2, title: 'Session 2' },
    ],
    items: [
      {
        id: 'legacy-item-1',
        blockId: 'legacy-block-1',
        itemNumber: 1,
        sourceDay: 'Day 2',
        sourceStt: 'S1',
        unitOhm: 3,
        cciValue: 3,
        termVi: 'A',
        termEn: 'A en',
        promptVi: 'Câu A',
        promptEn: 'Sentence A',
        tc: 3,
        lc: 1,
        tl: 1,
        cvrValue: 3,
      },
      {
        id: 'legacy-item-2',
        blockId: 'legacy-block-1',
        itemNumber: 2,
        sourceDay: 'Day 2',
        sourceStt: 'S2',
        unitOhm: 3,
        cciValue: 3,
        termVi: 'B',
        termEn: 'B en',
        promptVi: 'Câu B',
        promptEn: 'Sentence B',
        tc: 2,
        lc: 2,
        tl: 1,
        cvrValue: 4,
      },
      {
        id: 'legacy-item-3',
        blockId: 'legacy-block-2',
        itemNumber: 1,
        sourceDay: 'Day 3',
        sourceStt: 'S3',
        unitOhm: 5,
        cciValue: 5,
        termVi: 'C',
        termEn: 'C en',
        promptVi: 'Câu C',
        promptEn: 'Sentence C',
        tc: null,
        lc: null,
        tl: null,
        cvrBreakdown: { tc: 5, lc: 1, tl: 1 },
        cvrValue: 5,
      },
    ],
    learningSessions: [
      {
        id: 'session-lesson',
        sessionFormat: 'lesson',
        liveTestResourceId: null,
        liveTestBlockId: null,
      },
      {
        id: 'session-test',
        sessionFormat: 'test',
        liveTestResourceId: 'legacy-resource-1',
        liveTestBlockId: 'legacy-block-1',
      },
    ],
    sessionQuestions: [
      {
        id: 'question-1',
        learningSessionId: 'session-test',
        sequenceNumber: 1,
        externalRef: 'live-test-item:legacy-item-1',
      },
      {
        id: 'question-2',
        learningSessionId: 'session-test',
        sequenceNumber: 2,
        externalRef: 'live-test-item:legacy-item-missing',
      },
    ],
    users: [
      {
        id: 'admin-1',
        email: 'admin@example.com',
        authUserId: 'auth-admin-1',
        clerkUserId: null,
        legacyClerkUserId: 'clerk-admin-1',
        role: 'admin',
      },
      {
        id: 'learner-1',
        email: 'learner@example.com',
        authUserId: null,
        clerkUserId: 'clerk-learner-1',
        legacyClerkUserId: 'clerk-learner-1',
        role: 'learner',
      },
    ],
    learnerAccessTokens: [
      {
        id: 'token-1',
        tokenHash: 'sha256:hashed-token-only',
        learnerUserId: 'learner-1',
        classId: 'class-1',
        expiresAt: '2026-08-18T00:00:00.000Z',
        revokedAt: null,
      },
    ],
    lifecycleCounts: {
      learningSessions: 2,
      sessionQuestions: 2,
      assessmentAttempts: 2,
      assessmentEvents: 5,
      assessmentAttemptSnapshots: 2,
      corrections: 1,
    },
  }
}

describe('live test V2 migration preview', () => {
  it('parses the one-time CSV rows with quoted values', () => {
    const rows = parseCsvRows('A,B\n"hello, Lucy",2\n')
    expect(rows).toEqual([{ A: 'hello, Lucy', B: '2' }])
  })

  it('builds deterministic CSV and legacy staging counts without remote mutation', () => {
    const first = previewLiveTestV2Migration(baseInput())
    const second = previewLiveTestV2Migration(baseInput())

    expect(first.remoteMutation).toBe(false)
    expect(first.localOnly).toBe(true)
    expect(first.deterministicChecksum).toBe(second.deterministicChecksum)
    expect(first.counts).toMatchObject({
      csvRows: 3,
      legacyResources: 1,
      legacyBlocks: 2,
      legacyItems: 3,
      targetPackages: 1,
      targetPackageVersions: 1,
      targetSections: 2,
      targetItems: 3,
      cciCategories: 2,
      liveTestSessions: 1,
      liveTestExternalRefs: 2,
      resolvedExternalRefs: 1,
      unresolvedExternalRefs: 1,
    })
  })

  it('derives section target CVR from CSV Unit (Ohm) while keeping measured CVR item-level', () => {
    const preview = previewLiveTestV2Migration(baseInput())

    expect(preview.targetSections[0]).toMatchObject({
      legacyBlockId: 'legacy-block-1',
      sectionOrder: 1,
      targetCvrOhm: 3,
      cciValue: 3,
      sourceItemCount: 2,
      targetItemCount: 2,
    })
    expect(preview.targetItems[1]).toMatchObject({
      legacyItemId: 'legacy-item-2',
      measuredCvr: 4,
      storedLegacyCvr: 4,
      targetCvrOhm: 3,
      v2ItemCpd: 9,
      legacyCpd: 12,
    })
    expect(preview.anomalies.map((a) => a.code)).toContain('cpd.formula-variance')
  })

  it('maps legacy external_refs to immutable V2 refs without rewriting session_questions', () => {
    const preview = previewLiveTestV2Migration(baseInput())
    const mapping = preview.externalRefMappings[0]

    expect(mapping).toMatchObject({
      sessionQuestionId: 'question-1',
      legacyExternalRef: 'live-test-item:legacy-item-1',
      legacyItemId: 'legacy-item-1',
      resolution: 'resolved',
    })
    expect(mapping?.v2ExternalRef).toMatch(/^live-test-item:[a-f0-9-]{36}:v[a-f0-9-]{36}$/)
    expect(preview.historyGuard.noRewriteTables).toContain('session_questions')
    expect(preview.historyGuard.lifecycleCountsAfterDryRun).toEqual(preview.historyGuard.lifecycleCountsBefore)
    expect(preview.historyGuard.checksumAfterDryRun).toBe(preview.historyGuard.checksumBefore)
  })

  it('reports legacy Clerk compatibility, signed-token assumptions, and rollback readiness', () => {
    const preview = previewLiveTestV2Migration(baseInput())

    expect(preview.compatibility).toMatchObject({
      staffWithLegacyClerkRefs: 1,
      staffWithSupabaseAuthLinks: 1,
      learnersWithoutAuthAccounts: 1,
      learnerTokenSamples: 1,
      rawLearnerTokensPersisted: 0,
    })
    expect(preview.rollbackReadiness.restorePointRequired).toBe(true)
    expect(preview.rollbackReadiness.rollbackNotes.join('\n')).toContain('PITR restore point')
  })

  it('flags CSV section-target conflicts as blocking anomalies', () => {
    const input = baseInput()
    input.csvText = `${csv}1,Day 2,S4,D,D en,Câu D,Sentence D,9,3,1,1,3\n`

    const preview = previewLiveTestV2Migration(input)

    expect(preview.anomalies).toContainEqual(
      expect.objectContaining({ code: 'csv.section-target-conflict', severity: 'error' }),
    )
  })
})
