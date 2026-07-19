import type { PromptLanguage } from '../scheduling/types'

export type AudioAsset = {
  id: string
  organizationId: string | null
  storageBucket: string
  storagePath: string
  mimeType: string
  durationMs: number | null
  sha256: string | null
}

export type LiveTestResource = {
  id: string
  organizationId: string | null
  title: string
  version: string
  status: 'draft' | 'active' | 'archived'
  sourceFilename: string | null
}

export type LiveTestBlock = {
  id: string
  resourceId: string
  blockNumber: number
  title: string | null
  cciMin: number | null
  cciMax: number | null
  cciAvg: number | null
  cvrMin: number | null
  cvrMax: number | null
  cvrAvg: number | null
  cpdMin: number | null
  cpdMax: number | null
  cpdAvg: number | null
  introTextVi: string | null
  introTextEn: string | null
  introAudioViAssetId: string | null
  introAudioEnAssetId: string | null
}

export type LiveTestItem = {
  id: string
  blockId: string
  itemNumber: number
  sourceDay: string | null
  sourceStt: string | null
  unitOhm: number | null
  cciValue: number | null
  cciMeasure: string
  cciUnitLabel: string
  cciSource: string
  termVi: string
  termEn: string
  promptVi: string | null
  promptEn: string | null
  tc: number | null
  lc: number | null
  tl: number | null
  cvrValue: number | null
  cvrMeasure: string
  cvrUnitLabel: string
  cpdValue: number | null
  audioViAssetId: string | null
  audioEnAssetId: string | null
}

export function deriveCpd(
  cvr: number | null | undefined,
  cci: number | null | undefined,
): number | null {
  if (cvr == null || cci == null) return null
  return Math.round(cvr * cci * 100) / 100
}

export type LiveTestExternalRef = {
  itemId: string
  packageVersionId: string | null
}

export function liveTestExternalRef(itemId: string, packageVersionId?: string | null): string {
  if (!packageVersionId) return `live-test-item:${itemId}`
  return `live-test-item:${itemId}:v${packageVersionId}`
}

export function parseLiveTestExternalRef(
  ref: string | null | undefined,
): LiveTestExternalRef | null {
  if (!ref?.startsWith('live-test-item:')) return null
  const payload = ref.slice('live-test-item:'.length)
  if (!payload) return null
  const versionMarker = payload.lastIndexOf(':v')
  if (versionMarker < 0) return { itemId: payload, packageVersionId: null }
  const itemId = payload.slice(0, versionMarker)
  const packageVersionId = payload.slice(versionMarker + 2)
  if (!itemId || !packageVersionId) return null
  return { itemId, packageVersionId }
}

export function liveTestItemIdFromExternalRef(ref: string | null | undefined): string | null {
  return parseLiveTestExternalRef(ref)?.itemId ?? null
}

export function liveTestVersionIdFromExternalRef(ref: string | null | undefined): string | null {
  return parseLiveTestExternalRef(ref)?.packageVersionId ?? null
}

export function promptForLanguage(item: LiveTestItem, language: PromptLanguage): string | null {
  return language === 'en' ? item.promptEn : item.promptVi
}

export function audioAssetIdForLanguage(
  item: LiveTestItem,
  language: PromptLanguage,
): string | null {
  return language === 'en' ? item.audioEnAssetId : item.audioViAssetId
}

export function introTextForLanguage(
  block: LiveTestBlock,
  language: PromptLanguage,
): string | null {
  return language === 'en' ? block.introTextEn : block.introTextVi
}

export function introAudioAssetIdForLanguage(
  block: LiveTestBlock,
  language: PromptLanguage,
): string | null {
  return language === 'en' ? block.introAudioEnAssetId : block.introAudioViAssetId
}

export function blockSummary(block: LiveTestBlock): string {
  const cci =
    block.cciMin === block.cciMax ? block.cciMin : `${block.cciMin ?? '—'}–${block.cciMax ?? '—'}`
  const cvr =
    block.cvrMin === block.cvrMax ? block.cvrMin : `${block.cvrMin ?? '—'}–${block.cvrMax ?? '—'}`
  const cpd =
    block.cpdMin === block.cpdMax ? block.cpdMin : `${block.cpdMin ?? '—'}–${block.cpdMax ?? '—'}`
  return `CCI ${cci} · CVR ${cvr} · CPD ${cpd}`
}
