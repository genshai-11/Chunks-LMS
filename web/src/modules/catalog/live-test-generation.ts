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

export type NarrationGenerationTarget = 'package_start' | 'package_end' | 'section_intro' | 'test_item'

export function generateNarration(input: {
  packageVersionId: string
  target: NarrationGenerationTarget
  testSectionId?: string
  testItemId?: string
  textOverride?: string
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

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function uploadNarrationAudio(input: {
  packageVersionId: string
  target: Extract<NarrationGenerationTarget, 'package_start' | 'package_end'>
  language: 'vi' | 'en'
  voiceId: string
  sourceTextHash: string
  file: File
}): Promise<{ narrationVariantId: string; audioAssetId: string }> {
  const sb = getSupabase() as any
  if (!sb) throw new Error('Supabase is not configured')
  const { data: version, error: versionError } = await sb
    .from('test_package_versions')
    .select('id, test_packages(organization_id)')
    .eq('id', input.packageVersionId)
    .maybeSingle()
  if (versionError) throw new Error(versionError.message)
  const organizationId = version?.test_packages?.organization_id
  if (!organizationId) throw new Error('Package organization not found')
  const bytes = await input.file.arrayBuffer()
  const sha256 = `sha256:${await sha256Hex(bytes)}`
  const ext = input.file.name.split('.').pop()?.toLowerCase() || 'mp3'
  const storagePath = `narrations/${input.packageVersionId}/uploads/${input.target}-${input.language}-${Date.now()}.${ext}`
  const { error: uploadError } = await sb.storage
    .from('narration-audio')
    .upload(storagePath, input.file, { contentType: input.file.type || 'audio/mpeg', upsert: false })
  if (uploadError) throw new Error(uploadError.message)
  const { data: audio, error: audioError } = await sb
    .from('audio_assets')
    .insert({
      organization_id: organizationId,
      storage_bucket: 'narration-audio',
      storage_path: storagePath,
      mime_type: input.file.type || 'audio/mpeg',
      sha256,
      visibility: 'private',
      source_kind: 'custom_upload',
      bytes: input.file.size,
      metadata: { uploadedFor: input.target, fileName: input.file.name },
    })
    .select('id')
    .single()
  if (audioError) throw new Error(audioError.message)
  const { data: variant, error: variantError } = await sb
    .from('narration_variants')
    .insert({
      package_version_id: input.packageVersionId,
      narration_target: input.target,
      language: input.language,
      voice_id: input.voiceId,
      voice_label: input.voiceId,
      source_text_hash: input.sourceTextHash,
      audio_asset_id: audio.id,
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      provider_metadata: { uploaded: true, fileName: input.file.name },
    })
    .select('id')
    .single()
  if (variantError) throw new Error(variantError.message)
  return { narrationVariantId: variant.id, audioAssetId: audio.id }
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
