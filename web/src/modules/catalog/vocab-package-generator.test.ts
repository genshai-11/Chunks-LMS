import { describe, expect, it, vi } from 'vitest'
import {
  createGoogleCloudTtsAdapter,
} from '../../../../supabase/functions/live-test-generation/adapters'
import {
  fetchFirestoreLessons,
  fetchFirestoreLessonChunks,
  generatePackageStructure,
  persistDraftPackage,
  type FirestoreLessonChunk,
} from '../../../../supabase/functions/live-test-generation/vocab-package-generator'

const mockChunks: FirestoreLessonChunk[] = [
  { chunkId: 'c1', english: 'Morning', vietnamese: 'Buổi sáng', category: 'vocab' },
  { chunkId: 'c2', english: 'Delicious', vietnamese: 'Ngon lành', category: 'vocab' },
  { chunkId: 'c3', english: 'Bicycle', vietnamese: 'Xe đạp', category: 'vocab' },
  { chunkId: 'c4', english: 'Ride', vietnamese: 'Đi xe', category: 'phrase' },
  { chunkId: 'c5', english: 'Book', vietnamese: 'Quyển sách', category: 'vocab' },
  { chunkId: 'c6', english: 'Read', vietnamese: 'Đọc', category: 'phrase' },
  { chunkId: 'c7', english: 'Music', vietnamese: 'Âm nhạc', category: 'vocab' },
  { chunkId: 'c8', english: 'Relax', vietnamese: 'Thư giãn', category: 'phrase' },
  { chunkId: 'c9', english: 'Family', vietnamese: 'Gia đình', category: 'vocab' },
  { chunkId: 'c10', english: 'Warm', vietnamese: 'Ấm áp', category: 'vocab' },
  { chunkId: 'c11', english: 'Park', vietnamese: 'Công viên', category: 'vocab' },
  { chunkId: 'c12', english: 'Run', vietnamese: 'Chạy', category: 'phrase' },
  { chunkId: 'c13', english: 'Beach', vietnamese: 'Bãi biển', category: 'vocab' },
  { chunkId: 'c14', english: 'Beautiful', vietnamese: 'Đẹp', category: 'vocab' },
]

describe('Google Cloud TTS Adapter with SSML Break Support', () => {
  it('detects plain text and sends { text } without altering voice', async () => {
    let capturedBody: any = null
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        json: async () => ({ audioContent: btoa('mock-audio-data') }),
      }
    })

    const adapter = createGoogleCloudTtsAdapter({ apiKey: 'test-key' }, mockFetch as any)
    const result = await adapter.generateSpeech({
      text: 'Good morning',
      language: 'en',
      voiceId: 'google/en-US-Journey-F',
    })

    expect(result.format).toBe('mp3')
    expect(capturedBody.input).toEqual({ text: 'Good morning' })
    expect(capturedBody.voice.name).toBe('en-US-Journey-F')
    expect(result.providerMetadata.isSsml).toBe(false)
  })

  it('detects SSML tags and falls back from Journey voice to Neural2', async () => {
    let capturedBody: any = null
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        json: async () => ({ audioContent: btoa('mock-audio-data') }),
      }
    })

    const adapter = createGoogleCloudTtsAdapter({ apiKey: 'test-key' }, mockFetch as any)
    const ssmlText = '<s>Morning</s> <break time="650ms"/> <s>Delicious</s>'
    const result = await adapter.generateSpeech({
      text: ssmlText,
      language: 'en',
      voiceId: 'google/en-US-Journey-F',
    })

    expect(capturedBody.input).toEqual({
      ssml: `<speak>${ssmlText}</speak>`,
    })
    // Journey must fallback to en-US-Neural2-F
    expect(capturedBody.voice.name).toBe('en-US-Neural2-F')
    expect(result.providerMetadata.isSsml).toBe(true)
    expect(result.providerMetadata.voiceName).toBe('en-US-Neural2-F')
  })

  it('detects SSML with Vietnamese language and falls back Journey to vi-VN-Neural2-A', async () => {
    let capturedBody: any = null
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        json: async () => ({ audioContent: btoa('mock-audio-data') }),
      }
    })

    const adapter = createGoogleCloudTtsAdapter({ apiKey: 'test-key' }, mockFetch as any)
    const ssmlText = '<speak><s>Buổi sáng</s> <break time="650ms"/> <s>Ngon lành</s></speak>'
    const result = await adapter.generateSpeech({
      text: ssmlText,
      language: 'vi',
      voiceId: 'google/vi-VN-Journey-D',
    })

    expect(capturedBody.input).toEqual({ ssml: ssmlText })
    expect(capturedBody.voice.name).toBe('vi-VN-Neural2-A')
    expect(result.providerMetadata.isSsml).toBe(true)
  })
})

describe('Firestore Vocab Ingestion', () => {
  it('parses and sorts lessons by levelCode and dayNumber', async () => {
    const mockResponse = {
      documents: [
        {
          name: 'projects/p/databases/(default)/documents/lessons/level_b_day_2',
          fields: {
            id: { stringValue: 'level_b_day_2' },
            lesson_title: { stringValue: 'Day 2 Level B' },
            level_code: { stringValue: 'LEVEL_B' },
            day_number: { integerValue: '2' },
            total_chunks: { integerValue: '50' },
          },
        },
        {
          name: 'projects/p/databases/(default)/documents/lessons/level_a_day_10',
          fields: {
            id: { stringValue: 'level_a_day_10' },
            lesson_title: { stringValue: 'Day 10 Level A' },
            level_code: { stringValue: 'LEVEL_A' },
            day_number: { integerValue: '10' },
            total_chunks: { integerValue: '60' },
          },
        },
        {
          name: 'projects/p/databases/(default)/documents/lessons/level_a_day_1',
          fields: {
            id: { stringValue: 'level_a_day_1' },
            lesson_title: { stringValue: 'Day 1 Level A' },
            level_code: { stringValue: 'LEVEL_A' },
            day_number: { integerValue: '1' },
            total_chunks: { integerValue: '110' },
          },
        },
      ],
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    })

    const lessons = await fetchFirestoreLessons('fake-key', mockFetch as any)
    expect(lessons).toHaveLength(3)
    // LEVEL_A day 1 comes before LEVEL_A day 10, which comes before LEVEL_B day 2
    expect(lessons[0].id).toBe('level_a_day_1')
    expect(lessons[0].dayNumber).toBe(1)
    expect(lessons[1].id).toBe('level_a_day_10')
    expect(lessons[1].dayNumber).toBe(10)
    expect(lessons[2].id).toBe('level_b_day_2')
    expect(lessons[2].levelCode).toBe('LEVEL_B')
  })

  it('parses lesson chunks correctly', async () => {
    const mockDoc = {
      fields: {
        chunks: {
          arrayValue: {
            values: [
              {
                mapValue: {
                  fields: {
                    chunk_id: { stringValue: 'chunk_01' },
                    english: { stringValue: 'Apple' },
                    vietnamese: { stringValue: 'Quả táo' },
                    category: { stringValue: 'noun' },
                  },
                },
              },
              {
                mapValue: {
                  fields: {
                    chunk_id: { stringValue: 'chunk_02' },
                    english: { stringValue: 'Eat' },
                    vietnamese: { stringValue: 'Ăn' },
                  },
                },
              },
            ],
          },
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDoc,
    })

    const chunks = await fetchFirestoreLessonChunks('level_a_day_1', 'fake-key', mockFetch as any)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual({
      chunkId: 'chunk_01',
      english: 'Apple',
      vietnamese: 'Quả táo',
      category: 'noun',
    })
    expect(chunks[1]).toEqual({
      chunkId: 'chunk_02',
      english: 'Eat',
      vietnamese: 'Ăn',
      category: undefined,
    })
  })
})

describe('Dynamic Green & Red Test Package Generator', () => {
  it('generates Green Test with 1 chunk per item, TL=1.0, and progressive CVR', () => {
    const pkg = generatePackageStructure({
      testType: 'GREEN',
      lessonId: 'level_a_day_1',
      chunks: mockChunks,
      targetQuestions: 42,
    })

    expect(pkg.testType).toBe('GREEN')
    expect(pkg.totalItems).toBe(42)
    expect(pkg.sections).toHaveLength(6) // 6 sessions x 7 items = 42

    // Check session 1
    const s1 = pkg.sections[0]
    expect(s1.items).toHaveLength(7)
    expect(s1.targetCvrOhm).toBeLessThanOrEqual(3) // Session 1-2: CVR 1-3 Ohm
    expect(s1.introTextVi).toContain('Session 1')
    expect(s1.introTextVi).toContain('Ohm')
    expect(s1.introTextVi).toContain('Ampe')

    // Every item in Green test has TL = 1.0 and plain prompts, no SSML
    for (const section of pkg.sections) {
      for (const item of section.items) {
        expect(item.tl).toBe(1.0)
        expect(item.measuredCvr).toBe(item.tc * item.lc * 1.0)
        expect(item.spokenScriptVi).toBeNull()
        expect(item.spokenScriptEn).toBeNull()
        expect(item.chunkIds).toHaveLength(1)
      }
    }

    // Progression: Session 1-2 (1-3 Ohm), Session 3-4 (5-7 Ohm), Session 5-6 (9-13 Ohm)
    expect(pkg.sections[0].targetCvrOhm).toBeGreaterThanOrEqual(1)
    expect(pkg.sections[0].targetCvrOhm).toBeLessThanOrEqual(3)
    expect(pkg.sections[2].targetCvrOhm).toBeGreaterThanOrEqual(5)
    expect(pkg.sections[2].targetCvrOhm).toBeLessThanOrEqual(7)
    expect(pkg.sections[5].targetCvrOhm).toBeGreaterThanOrEqual(9)
    expect(pkg.sections[5].targetCvrOhm).toBeLessThanOrEqual(13)

    // Lifecycle narration scripts
    expect(pkg.lifecycleNarration.package_start.vi).toContain('Green Test (Focus)')
    expect(pkg.lifecycleNarration.package_end.en).toContain('Green Test (Focus)')
    expect(pkg.lifecycleNarration.part_intro[1].vi).toBeDefined()
    expect(pkg.lifecycleNarration.part_intro[2].vi).toBeDefined()
    expect(pkg.lifecycleNarration.part_intro[3].vi).toBeDefined()
  })

  it('generates Red Test with 2-3 chunks per item, TL in [2.0, 3.0], SSML breaks, and target CPD 56V', () => {
    const pkg = generatePackageStructure({
      testType: 'RED',
      lessonId: 'level_a_day_1',
      chunks: mockChunks,
      targetQuestions: 42,
      targetCpd: 56,
      packageCode: 'R01-42Q-56V',
    })

    expect(pkg.testType).toBe('RED')
    expect(pkg.packageCode).toBe('R01-42Q-56V')
    expect(pkg.totalItems).toBe(42)
    expect(pkg.sections).toHaveLength(6)

    for (const section of pkg.sections) {
      expect(section.items).toHaveLength(7)
      for (const item of section.items) {
        expect(item.tl).toBeGreaterThanOrEqual(2.0)
        expect(item.tl).toBeLessThanOrEqual(3.0)
        expect(item.chunkIds.length).toBeGreaterThanOrEqual(2)
        expect(item.chunkIds.length).toBeLessThanOrEqual(3)

        // SSML spoken scripts with break
        expect(item.spokenScriptEn).toContain('<speak>')
        expect(item.spokenScriptEn).toContain('<break time="650ms"/>')
        expect(item.spokenScriptEn).toContain('</speak>')
        expect(item.spokenScriptVi).toContain('<speak>')
        expect(item.spokenScriptVi).toContain('<break time="650ms"/>')
        expect(item.spokenScriptVi).toContain('</speak>')

        // Prompts combine chunks with /
        expect(item.promptEn).toContain(' / ')
        expect(item.promptVi).toContain(' / ')
      }
    }

    // Lifecycle narration scripts
    expect(pkg.lifecycleNarration.package_start.vi).toContain('Red Test (Awareness')
    expect(pkg.lifecycleNarration.package_end.en).toContain('Red Test (Awareness')
  })

  it('persists draft package to Supabase database tables', async () => {
    const pkg = generatePackageStructure({
      testType: 'GREEN',
      lessonId: 'level_a_day_1',
      chunks: mockChunks,
      targetQuestions: 21,
    })

    const inserted: Record<string, any[]> = {
      test_packages: [],
      test_package_versions: [],
      test_sections: [],
      test_items: [],
    }

    const mockAdmin: any = {
      from: (table: string) => ({
        select: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: { id: 'org-123' }, error: null }),
            }),
          }),
          eq: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: { organization_id: 'org-123' }, error: null }),
            }),
          }),
        }),
        insert: (rows: any) => {
          const rowArr = Array.isArray(rows) ? rows : [rows]
          const withIds = rowArr.map((r) => ({ id: `uuid-${Math.random()}`, ...r }))
          inserted[table].push(...withIds)
          return {
            select: () => ({
              single: async () => ({ data: withIds[0], error: null }),
            }),
            then: (cb: any) => cb({ error: null }),
          }
        },
      }),
    }

    const receipt = await persistDraftPackage(pkg, 'user-actor-1', mockAdmin)
    expect(receipt.packageId).toBeDefined()
    expect(receipt.packageVersionId).toBeDefined()
    expect(receipt.itemsCount).toBe(21)
    expect(inserted.test_packages).toHaveLength(1)
    expect(inserted.test_package_versions).toHaveLength(1)
    expect(inserted.test_sections).toHaveLength(3)
    expect(inserted.test_items).toHaveLength(21)
  })
})
