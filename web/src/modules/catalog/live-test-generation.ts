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

type SupabaseFunctionsClient = {
  functions: {
    invoke: (
      functionName: string,
      options: { body: Record<string, unknown> },
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  }
}

type LiveTestGenerationOptions = {
  /** Explicit local/CI-only adapter. Defaults to VITE_AUTH_BYPASS; never inferred from missing Supabase config. */
  useDeterministicMock?: boolean
}

function makeMockJobId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeReceipt(data: unknown): GenerationJobReceipt {
  const receipt = data as Record<string, unknown>
  const status = receipt.status as GenerationJobStatus
  const jobId = String(receipt.jobId)
  const requestedAt = String(receipt.requestedAt || new Date().toISOString())

  if (status === 'failed') {
    return {
      jobId,
      status,
      requestedAt,
      error: {
        code: String(receipt.errorCode || 'GENERATION_FAILED'),
        message: String(receipt.errorMessage || 'Generation failed'),
      },
    }
  }

  return {
    jobId,
    status,
    requestedAt,
    completedAt: receipt.completedAt ? String(receipt.completedAt) : undefined,
    itemPreview: receipt.itemPreview as { promptVi: string; promptEn: string } | undefined,
    narrationVariantId: receipt.narrationVariantId ? String(receipt.narrationVariantId) : undefined,
    audioPath: receipt.audioPath ? String(receipt.audioPath) : undefined,
  }
}

export class SupabaseLiveTestGeneration implements LiveTestGeneration {
  private readonly useDeterministicMock: boolean

  constructor(options: LiveTestGenerationOptions = {}) {
    this.useDeterministicMock = options.useDeterministicMock ?? env.authBypass
  }

  async generateTestItem(command: {
    packageVersionId: string
    sectionId: string
    promptDetails: string
  }): Promise<GenerationJobReceipt> {
    if (this.useDeterministicMock) {
      const now = new Date().toISOString()
      return {
        jobId: makeMockJobId('mock-job'),
        status: 'succeeded',
        requestedAt: now,
        completedAt: now,
        itemPreview: {
          promptVi: `[Mock] Câu hỏi mẫu tiếng Việt từ ${command.promptDetails}`,
          promptEn: `[Mock] Sample English prompt from ${command.promptDetails}`,
        },
      }
    }

    return normalizeReceipt(
      await this.invokeGenerationFunction({
        action: 'generateTestItem',
        packageVersionId: command.packageVersionId,
        sectionId: command.sectionId,
        promptDetails: command.promptDetails,
      }),
    )
  }

  async generateNarration(command: {
    packageVersionId: string
    target: 'section_intro' | 'test_item'
    testSectionId?: string | null
    testItemId?: string | null
    language: 'vi' | 'en'
    voiceId: string
  }): Promise<GenerationJobReceipt> {
    if (this.useDeterministicMock) {
      const jobId = makeMockJobId('mock-job')
      const now = new Date().toISOString()
      return {
        jobId,
        status: 'succeeded',
        requestedAt: now,
        completedAt: now,
        narrationVariantId: makeMockJobId('mock-variant'),
        audioPath: `narrations/mock/${jobId}.mp3`,
      }
    }

    return normalizeReceipt(
      await this.invokeGenerationFunction({
        action: 'generateNarration',
        packageVersionId: command.packageVersionId,
        target: command.target,
        testSectionId: command.testSectionId ?? null,
        testItemId: command.testItemId ?? null,
        language: command.language,
        voiceId: command.voiceId,
      }),
    )
  }

  async approveGeneratedAsset(command: {
    generationJobId: string
    notes?: string
  }): Promise<ApprovedGenerationAsset> {
    if (this.useDeterministicMock) {
      return {
        narrationVariantId: makeMockJobId('mock-variant'),
        approvedAt: new Date().toISOString(),
        approvedByUserId: 'mock-admin-id',
        approved: true,
      }
    }

    const approval = (await this.invokeGenerationFunction({
      action: 'approveGeneratedAsset',
      generationJobId: command.generationJobId,
      notes: command.notes || '',
    })) as Record<string, unknown>

    return {
      narrationVariantId: String(approval.narrationVariantId),
      approvedAt: String(approval.approvedAt || new Date().toISOString()),
      approvedByUserId: String(approval.approvedByUserId || ''),
      approved: approval.approved === true || approval.approved === 'true',
      message: approval.message ? String(approval.message) : undefined,
    }
  }

  private async invokeGenerationFunction(body: Record<string, unknown>): Promise<unknown> {
    const supabase = getSupabase() as SupabaseFunctionsClient | null
    if (!supabase) {
      throw new Error(
        'Supabase is not configured; live-test generation cannot run outside explicit local/CI mock mode.',
      )
    }

    const { data, error } = await supabase.functions.invoke('live-test-generation', { body })
    if (error) {
      throw new Error(`live-test-generation failed: ${error.message}`)
    }

    const payload = data as { error?: { message?: string; code?: string } } | null
    if (payload?.error) {
      throw new Error(
        `live-test-generation failed: ${payload.error.message || payload.error.code || 'Unknown error'}`,
      )
    }

    return data
  }
}
