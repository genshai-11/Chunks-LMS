import { describe, expect, it, vi, afterEach } from 'vitest'
import { SupabaseLiveTestGeneration } from './live-test-generation'
import * as supabaseLib from '../../lib/supabase'

describe('SupabaseLiveTestGeneration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses deterministic mocks only when explicitly configured for local/CI', async () => {
    const generator = new SupabaseLiveTestGeneration({ useDeterministicMock: true })

    const itemReceipt = await generator.generateTestItem({
      packageVersionId: 'pkg-1',
      sectionId: 'sec-1',
      promptDetails: 'Design an item',
    })
    expect(itemReceipt.status).toBe('succeeded')
    expect(itemReceipt.jobId).toContain('mock-job-')
    expect(itemReceipt.itemPreview?.promptVi).toContain('Design an item')

    const narrationReceipt = await generator.generateNarration({
      packageVersionId: 'pkg-1',
      target: 'section_intro',
      testSectionId: 'sec-1',
      language: 'vi',
      voiceId: 'voice-a',
    })
    expect(narrationReceipt.status).toBe('succeeded')
    expect(narrationReceipt.narrationVariantId).toContain('mock-variant-')
    expect(narrationReceipt.audioPath).toContain('.mp3')

    const approval = await generator.approveGeneratedAsset({
      generationJobId: itemReceipt.jobId,
      notes: 'Approved',
    })
    expect(approval.approved).toBe(true)
    expect(approval.approvedByUserId).toBe('mock-admin-id')
  })

  it('does not silently mock when Supabase is missing outside explicit local/CI mode', async () => {
    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue(null)
    const generator = new SupabaseLiveTestGeneration({ useDeterministicMock: false })

    await expect(
      generator.generateTestItem({
        packageVersionId: 'pkg-1',
        sectionId: 'sec-1',
        promptDetails: 'Generate detail',
      }),
    ).rejects.toThrow('cannot run outside explicit local/CI mock mode')
  })

  it('delegates generation to the server-side Edge Function in online mode', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        jobId: 'real-job-id',
        status: 'succeeded',
        requestedAt: '2026-07-19T00:00:00Z',
        completedAt: '2026-07-19T00:00:05Z',
        itemPreview: { promptVi: 'Vi', promptEn: 'En' },
      },
      error: null,
    })

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue({
      functions: { invoke: mockInvoke },
    } as any)
    const generator = new SupabaseLiveTestGeneration({ useDeterministicMock: false })

    const receipt = await generator.generateTestItem({
      packageVersionId: 'real-pkg-id',
      sectionId: 'real-sec-id',
      promptDetails: 'Generate detail',
    })

    expect(mockInvoke).toHaveBeenCalledWith('live-test-generation', {
      body: {
        action: 'generateTestItem',
        packageVersionId: 'real-pkg-id',
        sectionId: 'real-sec-id',
        promptDetails: 'Generate detail',
      },
    })
    expect(receipt.status).toBe('succeeded')
    expect(receipt.jobId).toBe('real-job-id')
    expect(receipt.itemPreview?.promptVi).toBe('Vi')
  })

  it('delegates narration to the server-side Edge Function so TTS bytes are generated and stored server-side', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        jobId: 'tts-job-id',
        status: 'succeeded',
        requestedAt: '2026-07-19T00:00:00Z',
        completedAt: '2026-07-19T00:00:05Z',
        narrationVariantId: 'variant-id',
        audioPath: 'narrations/pkg/tts-job-id.mp3',
      },
      error: null,
    })

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue({
      functions: { invoke: mockInvoke },
    } as any)
    const generator = new SupabaseLiveTestGeneration({ useDeterministicMock: false })

    const receipt = await generator.generateNarration({
      packageVersionId: 'real-pkg-id',
      target: 'test_item',
      testItemId: 'item-id',
      language: 'en',
      voiceId: 'openai/tts-1/alloy',
    })

    expect(mockInvoke).toHaveBeenCalledWith('live-test-generation', {
      body: {
        action: 'generateNarration',
        packageVersionId: 'real-pkg-id',
        target: 'test_item',
        testSectionId: null,
        testItemId: 'item-id',
        language: 'en',
        voiceId: 'openai/tts-1/alloy',
      },
    })
    expect(receipt.status).toBe('succeeded')
    expect(receipt.narrationVariantId).toBe('variant-id')
    expect(receipt.audioPath).toBe('narrations/pkg/tts-job-id.mp3')
  })

  it('handles failed generation job receipts without leaking adapter details to callers', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        jobId: 'failed-job-id',
        status: 'failed',
        requestedAt: '2026-07-19T00:00:00Z',
        errorCode: 'ERR401',
        errorMessage: '9Router rate limit exceeded',
      },
      error: null,
    })

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue({
      functions: { invoke: mockInvoke },
    } as any)
    const generator = new SupabaseLiveTestGeneration({ useDeterministicMock: false })

    const receipt = await generator.generateTestItem({
      packageVersionId: 'real-pkg-id',
      sectionId: 'real-sec-id',
      promptDetails: 'Generate',
    })

    expect(receipt.status).toBe('failed')
    expect(receipt.jobId).toBe('failed-job-id')
    expect(receipt.error?.code).toBe('ERR401')
    expect(receipt.error?.message).toBe('9Router rate limit exceeded')
  })

  it('uses the Edge Function for approval so human approval remains server-audited', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        narrationVariantId: 'variant-id',
        approvedAt: '2026-07-19T00:01:00Z',
        approvedByUserId: 'admin-id',
        approved: true,
      },
      error: null,
    })

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue({
      functions: { invoke: mockInvoke },
    } as any)
    const generator = new SupabaseLiveTestGeneration({ useDeterministicMock: false })

    const approval = await generator.approveGeneratedAsset({
      generationJobId: 'job-id',
      notes: 'reviewed',
    })

    expect(mockInvoke).toHaveBeenCalledWith('live-test-generation', {
      body: { action: 'approveGeneratedAsset', generationJobId: 'job-id', notes: 'reviewed' },
    })
    expect(approval.approved).toBe(true)
    expect(approval.approvedByUserId).toBe('admin-id')
  })
})
