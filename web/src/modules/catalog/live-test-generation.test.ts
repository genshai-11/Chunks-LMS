import { describe, expect, it, vi } from 'vitest'
import { SupabaseLiveTestGeneration } from './live-test-generation'
import * as supabaseLib from '../../lib/supabase'

describe('SupabaseLiveTestGeneration', () => {
  it('gracefully degrades to mock responses when Supabase client is bypassed', async () => {
    const generator = new SupabaseLiveTestGeneration()

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

  it('delegates to Supabase RPC in online mode', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        jobId: 'real-job-id',
        status: 'succeeded',
        requestedAt: '2026-07-19T00:00:00Z',
        completedAt: '2026-07-19T00:00:05Z',
        itemPreview: { promptVi: 'Vi', promptEn: 'En' },
      },
      error: null,
    })

    const mockSupabase = {
      rpc: mockRpc,
    }

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue(mockSupabase as any)
    // Force env mock bypass to false temporarily
    const generator = new SupabaseLiveTestGeneration()

    const receipt = await generator.generateTestItem({
      packageVersionId: 'real-pkg-id',
      sectionId: 'real-sec-id',
      promptDetails: 'Generate detail',
    })

    expect(mockRpc).toHaveBeenCalledWith('generate_test_item', {
      p_package_version_id: 'real-pkg-id',
      p_test_section_id: 'real-sec-id',
      p_prompt_details: 'Generate detail',
    })
    expect(receipt.status).toBe('succeeded')
    expect(receipt.jobId).toBe('real-job-id')
    expect(receipt.itemPreview?.promptVi).toBe('Vi')

    vi.restoreAllMocks()
  })

  it('handles failed generation jobs correctly', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        jobId: 'failed-job-id',
        status: 'failed',
        requestedAt: '2026-07-19T00:00:00Z',
        errorCode: 'ERR401',
        errorMessage: '9Router rate limit exceeded',
      },
      error: null,
    })

    const mockSupabase = {
      rpc: mockRpc,
    }

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue(mockSupabase as any)
    const generator = new SupabaseLiveTestGeneration()

    const receipt = await generator.generateTestItem({
      packageVersionId: 'real-pkg-id',
      sectionId: 'real-sec-id',
      promptDetails: 'Generate',
    })

    expect(receipt.status).toBe('failed')
    expect(receipt.jobId).toBe('failed-job-id')
    expect(receipt.error?.code).toBe('ERR401')
    expect(receipt.error?.message).toBe('9Router rate limit exceeded')

    vi.restoreAllMocks()
  })
})
