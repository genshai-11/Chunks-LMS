import { getSupabase } from '../../lib/supabase'

export type GenerationReceipt = {
  jobId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  narrationVariantId?: string
  audioPath?: string
  errorMessage?: string
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase() as any
  if (!sb) throw new Error('Supabase is not configured')
  const { data, error } = await sb.functions.invoke('live-test-generation', { body })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error.message ?? data.error.code ?? 'Generation failed')
  return data as T
}

export function getLiveTestGenerationCapabilities(): Promise<{
  version: number
  exactSpokenScripts: boolean
  signedNarrationPlayback: boolean
  paidGenerationRequiresExplicitAction: boolean
}> {
  return invoke({ action: 'getCapabilities' })
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
