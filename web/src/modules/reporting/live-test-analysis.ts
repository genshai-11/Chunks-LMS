import type { LiveTestItem } from '../assessment/live-test'
import { deriveCpd, liveTestItemIdFromExternalRef } from '../assessment/live-test'
import type { ResultColor } from '../result-lifecycle/types'
import type { ResultRecord } from './progress'

export type LiveTestResultRecord = ResultRecord & {
  liveTestItemId: string
  itemNumber: number
  prompt: string | null
  cciValue: number | null
  cvrValue: number | null
  cpdValue: number | null
}

export type BandKey = 'low' | 'medium' | 'high' | 'unknown'

export function joinLiveTestResults(input: {
  records: ResultRecord[]
  itemById: Map<string, LiveTestItem>
  promptLanguage: 'vi' | 'en'
  /** Optional lookup if the caller has session_question.external_ref by question id. */
  externalRefByQuestionId?: Map<string, string | null>
}): LiveTestResultRecord[] {
  const rows: LiveTestResultRecord[] = []
  for (const record of input.records) {
    const ref = input.externalRefByQuestionId?.get(record.sessionQuestionId) ?? null
    const itemId = liveTestItemIdFromExternalRef(ref)
    if (!itemId) continue
    const item = input.itemById.get(itemId)
    if (!item) continue
    rows.push({
      ...record,
      liveTestItemId: itemId,
      itemNumber: item.itemNumber,
      prompt: input.promptLanguage === 'en' ? item.promptEn : item.promptVi,
      cciValue: item.cciValue,
      cvrValue: item.cvrValue,
      cpdValue: item.cpdValue ?? deriveCpd(item.cvrValue, item.cciValue),
    })
  }
  return rows
}

export function bandFor(value: number | null | undefined, cuts: { lowMax: number; mediumMax: number }): BandKey {
  if (value == null || Number.isNaN(value)) return 'unknown'
  if (value <= cuts.lowMax) return 'low'
  if (value <= cuts.mediumMax) return 'medium'
  return 'high'
}

export type ColorDistribution = Record<ResultColor, number> & { sample: number }

export function colorDistributionByBand(
  rows: LiveTestResultRecord[],
  metric: 'cciValue' | 'cvrValue' | 'cpdValue',
  cuts: { lowMax: number; mediumMax: number },
): Record<BandKey, ColorDistribution> {
  const empty = (): ColorDistribution => ({
    red: 0,
    orange: 0,
    yellow: 0,
    green: 0,
    blue: 0,
    indigo: 0,
    purple: 0,
    sample: 0,
  })
  const out: Record<BandKey, ColorDistribution> = {
    low: empty(),
    medium: empty(),
    high: empty(),
    unknown: empty(),
  }
  for (const row of rows) {
    const band = bandFor(row[metric], cuts)
    if (out[band][row.effectiveColor] !== undefined) {
      out[band][row.effectiveColor] += 1
    }
    out[band].sample += 1
  }
  return out
}
