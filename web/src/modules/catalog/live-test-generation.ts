import { getSupabase } from '../../lib/supabase'

export type GenerationReceipt = {
  jobId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  narrationVariantId?: string
  audioPath?: string
  errorMessage?: string
}

async function readFunctionError(error: unknown, data: any): Promise<string | null> {
  const dataMessage = data?.error?.message ?? data?.error?.code ?? data?.message
  if (dataMessage) return String(dataMessage)

  const context = (error as { context?: unknown })?.context
  if (context && typeof Response !== 'undefined' && context instanceof Response) {
    const response = context.clone()
    const text = await response.text().catch(() => '')
    if (!text) return null
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } | string; message?: string }
      if (typeof parsed.error === 'string') return parsed.error
      return parsed.error?.message ?? parsed.error?.code ?? parsed.message ?? text
    } catch {
      return text
    }
  }
  return null
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase() as any
  if (!sb) throw new Error('Supabase is not configured')
  const { data, error } = await sb.functions.invoke('live-test-generation', { body })
  if (error) {
    const functionMessage = await readFunctionError(error, data)
    throw new Error(functionMessage ? `${error.message}: ${functionMessage}` : error.message)
  }
  if (data?.error) throw new Error(data.error.message ?? data.error.code ?? 'Generation failed')
  return data as T
}

export function getLiveTestGenerationCapabilities(): Promise<{
  version: number
  exactSpokenScripts: boolean
  signedNarrationPlayback: boolean
  ttsModelDiscovery: boolean
  selectedBatchGeneration: boolean
  paidGenerationRequiresExplicitAction: boolean
}> {
  return invoke({ action: 'getCapabilities' })
}

export function listTtsModels(language: 'vi' | 'en'): Promise<{
  language: 'vi' | 'en'
  models: Array<{ id: string; provider: string; label: string }>
}> {
  return invoke({ action: 'listTtsModels', language })
}

export function generateNarration(input: {
  packageVersionId: string
  target: 'section_intro' | 'test_item'
  testSectionId?: string
  testItemId?: string
  language: 'vi' | 'en'
  voiceId: string
}): Promise<GenerationReceipt> {
  return invoke({ action: 'generateNarration', ...input })
}

export function approveGeneratedAsset(
  generationJobId: string,
  notes = '',
): Promise<{ narrationVariantId: string; approved: boolean }> {
  return invoke({ action: 'approveGeneratedAsset', generationJobId, notes })
}

export function getNarrationPlaybackUrl(narrationVariantId: string): Promise<{
  narrationVariantId: string
  signedUrl: string
  expiresIn: number
  mimeType: string
  durationMs: number | null
}> {
  return invoke({ action: 'getNarrationPlaybackUrl', narrationVariantId })
}
