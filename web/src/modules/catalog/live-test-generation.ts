import { getSupabase } from '../../lib/supabase'
import { env } from '../../env'

export type GenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type GenerationJobReceipt = {
  jobId: string
  status: GenerationJobStatus
  requestedAt: string
  completedAt?: string
  itemPreview?: {
    promptVi: string
    promptEn: string
  }
  narrationVariantId?: string
  audioPath?: string
  error?: {
    code: string
    message: string
  }
}

export type ApprovedGenerationAsset = {
  narrationVariantId: string
  approvedAt: string
  approvedByUserId: string
  approved: boolean
  message?: string
}

export interface LiveTestGeneration {
  generateTestItem(command: {
    packageVersionId: string
    sectionId: string
    promptDetails: string
  }): Promise<GenerationJobReceipt>

  generateNarration(command: {
    packageVersionId: string
    target: 'section_intro' | 'test_item'
    testSectionId?: string | null
    testItemId?: string | null
    language: 'vi' | 'en'
    voiceId: string
  }): Promise<GenerationJobReceipt>

  approveGeneratedAsset(command: {
    generationJobId: string
    notes?: string
  }): Promise<ApprovedGenerationAsset>
}

export class SupabaseLiveTestGeneration implements LiveTestGeneration {
  async generateTestItem(command: {
    packageVersionId: string
    sectionId: string
    promptDetails: string
  }): Promise<GenerationJobReceipt> {
    const supabase = getSupabase()
    
    // Graceful degradation for mock/development/CI environments
    if (!supabase || env.authBypass) {
      const jobId = 'mock-job-' + Math.random().toString(36).slice(2, 10)
      return {
        jobId,
        status: 'succeeded',
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        itemPreview: {
          promptVi: `[Mock] Câu hỏi mẫu tiếng Việt từ ${command.promptDetails}`,
          promptEn: `[Mock] Sample English prompt from ${command.promptDetails}`,
        },
      }
    }

    const { data, error } = await supabase.rpc('generate_test_item', {
      p_package_version_id: command.packageVersionId,
      p_test_section_id: command.sectionId,
      p_prompt_details: command.promptDetails,
    })

    if (error) {
      throw new Error(`generateTestItem failed: ${error.message}`)
    }

    const receipt = data as Record<string, unknown>
    if (receipt.status === 'failed') {
      return {
        jobId: String(receipt.jobId),
        status: 'failed',
        requestedAt: String(receipt.requestedAt || new Date().toISOString()),
        error: {
          code: String(receipt.errorCode),
          message: String(receipt.errorMessage),
        },
      }
    }

    return {
      jobId: String(receipt.jobId),
      status: receipt.status as GenerationJobStatus,
      requestedAt: String(receipt.requestedAt),
      completedAt: String(receipt.completedAt),
      itemPreview: receipt.itemPreview as { promptVi: string; promptEn: string } | undefined,
    }
  }

  async generateNarration(command: {
    packageVersionId: string
    target: 'section_intro' | 'test_item'
    testSectionId?: string | null
    testItemId?: string | null
    language: 'vi' | 'en'
    voiceId: string
  }): Promise<GenerationJobReceipt> {
    const supabase = getSupabase()

    if (!supabase || env.authBypass) {
      const jobId = 'mock-job-' + Math.random().toString(36).slice(2, 10)
      const variantId = 'mock-variant-' + Math.random().toString(36).slice(2, 10)
      return {
        jobId,
        status: 'succeeded',
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        narrationVariantId: variantId,
        audioPath: `narrations/${jobId}.mp3`,
      }
    }

    const { data, error } = await supabase.rpc('generate_narration', {
      p_package_version_id: command.packageVersionId,
      p_target: command.target,
      p_test_section_id: command.testSectionId || null,
      p_test_item_id: command.testItemId || null,
      p_language: command.language,
      p_voice_id: command.voiceId,
    })

    if (error) {
      throw new Error(`generateNarration failed: ${error.message}`)
    }

    const receipt = data as Record<string, unknown>
    if (receipt.status === 'failed') {
      return {
        jobId: String(receipt.jobId),
        status: 'failed',
        requestedAt: String(receipt.requestedAt || new Date().toISOString()),
        error: {
          code: String(receipt.errorCode),
          message: String(receipt.errorMessage),
        },
      }
    }

    return {
      jobId: String(receipt.jobId),
      status: receipt.status as GenerationJobStatus,
      requestedAt: String(receipt.requestedAt),
      completedAt: String(receipt.completedAt),
      narrationVariantId: String(receipt.narrationVariantId),
      audioPath: String(receipt.audioPath),
    }
  }

  async approveGeneratedAsset(command: {
    generationJobId: string
    notes?: string
  }): Promise<ApprovedGenerationAsset> {
    const supabase = getSupabase()

    if (!supabase || env.authBypass) {
      return {
        narrationVariantId: 'mock-variant-' + Math.random().toString(36).slice(2, 10),
        approvedAt: new Date().toISOString(),
        approvedByUserId: 'mock-admin-id',
        approved: true,
      }
    }

    const { data, error } = await supabase.rpc('approve_generated_asset', {
      p_generation_job_id: command.generationJobId,
      p_notes: command.notes || '',
    })

    if (error) {
      throw new Error(`approveGeneratedAsset failed: ${error.message}`)
    }

    const approval = data as Record<string, unknown>
    return {
      narrationVariantId: String(approval.narrationVariantId),
      approvedAt: String(approval.approvedAt || new Date().toISOString()),
      approvedByUserId: String(approval.approvedByUserId || ''),
      approved: approval.approved === true || approval.approved === 'true',
      message: approval.message ? String(approval.message) : undefined,
    }
  }
}
