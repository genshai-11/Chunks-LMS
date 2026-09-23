/**
 * CHUNKS Improv Service & Red Test Integration Engine
 * Reused and adapted from chunks-classroom (chunks-class/src/services/improvService.ts)
 * 
 * Provides:
 * 1. Exact Improv domain models (ImprovHint, ImprovItem, ImprovSession, ImprovPackage).
 * 2. Expanded Hint Types for Cognitive Awareness & Traps (Plosive, Scale Contrast, Latency Hold, etc.).
 * 3. Batch calculation, language sanitization, and Excel formatting matching exportImprovPackageToExcel.
 * 4. Conversion bridge between Improv Packages and Chunks LMS Red Test Packages (CVR, CCI, CPD, SSML).
 */

export interface ImprovHint {
  id: string
  text: string
  translation: string
  typeFunction: string
  itemIndex: number
  audioUrl?: string
  audioUrlVi?: string
}

export interface ImprovItem {
  id: string
  itemNumber: number
  sessionNumber: number
  hcTotal: number
  hints: ImprovHint[]
  audioUrl?: string
  audioUrlVi?: string
  createdAt?: string
}

export interface ImprovSession {
  sessionNumber: number
  title: string
  hcTotal: number
  hintTypes: string[]
  items: ImprovItem[]
  targetCvrOhm?: number
  cciAmps?: number
  cpdVoltage?: number
}

export interface ImprovPackage {
  id: string
  title: string
  description: string
  totalItems: number
  sessionsCount: number
  sessions: ImprovSession[]
  createdAt: string
  updatedAt: string
  sourceCourseLevel?: string
  sourceLessonIds?: string[]
}

export interface ImprovSessionConfig {
  sessionNumber: number
  hcTotal: number
  hintTypes: string[]
  itemsCount: number
  targetCvrOhm?: number
  cciAmps?: number
}

export interface ImprovGenerateRequest {
  packageTitle: string
  packageDescription?: string
  totalItems: number
  sessionsCount?: number
  sessionsConfig: ImprovSessionConfig[]
  sourceLevel: string
  sourceLessonIds: string[]
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | string
  relevance: 'LOW' | 'MEDIUM' | 'HIGH' | string
}

// --------------------------------------------------------------------------
export const EXPANDED_HINT_TYPES = {
  // Classic Improv Studio Hint Types (1-2 hints standard)
  KEYWORD: 'Keyword · Cụm phản xạ trọng tâm',
  ENDING: 'Ending · Cụm phối hợp tự nhiên / Kết quả',
  LOGIC_WORD: 'Từ nối · Logic word',
  FANCY_WORD: 'Ẩn dụ / Cụm gợi hình · Fancy word',
  INTRO_SETUP: 'Intro / Setup · Mở đầu dẫn dắt',
  PROVERB: 'Tục ngữ / Thành ngữ · Proverb',
  WH_QUESTION: 'Cụm nghi vấn · WH word',

  // Chunks LMS Awareness Traps (Scale Contrast removed per pedadogical directive)
  PHONETIC_PLOSIVE: 'Phonetic Plosive · Bẫy trượt âm cuối',
  LATENCY_HOLD: 'Latency Hold · Kiềm chế qua khoảng lặng (650ms)',
  SEMANTIC_CLASH: 'Semantic Clash · Xung đột trường nghĩa',
  COORDINATION_TRAP: 'Coordination Trap · Cặp liên từ đối lập',
  FAMILIARITY_SUPPRESSION: 'Familiarity Suppression · Ức chế quán tính',
  SYNTACTIC_REDUNDANCY: 'Syntactic Redundancy · Khử lặp từ vựng',
  SPATIAL_VS_ACTION: 'Spatial vs Action · Địa điểm vs Hành động',
} as const

/**
 * Standard dynamic session config for Red test:
 * Default progression: 7 sessions with item counts [2, 3, 4, 2, 3, 4, 5] (Total 23 items).
 * Hint structure: 1-2 hints per item (hcTotal = 2 or 1), natural collocations, NO Scale Contrast.
 * Highly configurable before generation.
 */
export const DEFAULT_RED_TEST_SESSION_CONFIGS: ImprovSessionConfig[] = [
  { sessionNumber: 1, hcTotal: 2, itemsCount: 2, hintTypes: [EXPANDED_HINT_TYPES.KEYWORD, EXPANDED_HINT_TYPES.ENDING], targetCvrOhm: 1, cciAmps: 2 },
  { sessionNumber: 2, hcTotal: 2, itemsCount: 3, hintTypes: [EXPANDED_HINT_TYPES.KEYWORD, EXPANDED_HINT_TYPES.ENDING], targetCvrOhm: 3, cciAmps: 2 },
  { sessionNumber: 3, hcTotal: 2, itemsCount: 4, hintTypes: [EXPANDED_HINT_TYPES.KEYWORD, EXPANDED_HINT_TYPES.ENDING], targetCvrOhm: 5, cciAmps: 4 },
  { sessionNumber: 4, hcTotal: 2, itemsCount: 2, hintTypes: [EXPANDED_HINT_TYPES.KEYWORD, EXPANDED_HINT_TYPES.ENDING], targetCvrOhm: 7, cciAmps: 4 },
  { sessionNumber: 5, hcTotal: 2, itemsCount: 3, hintTypes: [EXPANDED_HINT_TYPES.KEYWORD, EXPANDED_HINT_TYPES.ENDING], targetCvrOhm: 9, cciAmps: 4 },
  { sessionNumber: 6, hcTotal: 2, itemsCount: 4, hintTypes: [EXPANDED_HINT_TYPES.KEYWORD, EXPANDED_HINT_TYPES.ENDING], targetCvrOhm: 11, cciAmps: 6 },
  { sessionNumber: 7, hcTotal: 2, itemsCount: 5, hintTypes: [EXPANDED_HINT_TYPES.KEYWORD, EXPANDED_HINT_TYPES.ENDING], targetCvrOhm: 13, cciAmps: 8 },
]

// --------------------------------------------------------------------------
// 2. Micro-Batch Planning Algorithm (from chunks-class improvService.ts)
// --------------------------------------------------------------------------

export interface PlannedBatch {
  sessionNumber: number
  sessionConfig: ImprovSessionConfig
  batchIndex: number
  totalBatchesInSession: number
  startItem: number
  count: number
}

export function calculateBatches(
  sessionConfigs: ImprovSessionConfig[],
  microBatchThreshold = 8,
): PlannedBatch[] {
  const allBatches: PlannedBatch[] = []

  sessionConfigs.forEach((sConfig) => {
    const totalItems = sConfig.itemsCount || 5
    if (totalItems <= microBatchThreshold) {
      allBatches.push({
        sessionNumber: sConfig.sessionNumber,
        sessionConfig: sConfig,
        batchIndex: 0,
        totalBatchesInSession: 1,
        startItem: 1,
        count: totalItems,
      })
    } else {
      const batchSize = totalItems <= 12 ? Math.ceil(totalItems / 2) : 6
      let remaining = totalItems
      let currentStart = 1
      const sessionBatches: { startItem: number; count: number }[] = []
      while (remaining > 0) {
        const currentCount = Math.min(batchSize, remaining)
        sessionBatches.push({ startItem: currentStart, count: currentCount })
        currentStart += currentCount
        remaining -= currentCount
      }
      sessionBatches.forEach((b, bIdx) => {
        allBatches.push({
          sessionNumber: sConfig.sessionNumber,
          sessionConfig: sConfig,
          batchIndex: bIdx,
          totalBatchesInSession: sessionBatches.length,
          startItem: b.startItem,
          count: b.count,
        })
      })
    }
  })

  return allBatches
}

// --------------------------------------------------------------------------
// 3. Improv Package Excel Table Formatter (matching exportImprovPackageToExcel)
// --------------------------------------------------------------------------

export function buildImprovExcelAoa(pkg: ImprovPackage): (string | number | null)[][] {
  let maxHints = 4
  pkg.sessions.forEach((s) => {
    s.items.forEach((it) => {
      if (it.hints.length > maxHints) {
        maxHints = it.hints.length
      }
    })
  })

  const headers: string[] = ['Session', 'Item', 'hc-total']
  for (let h = 1; h <= maxHints; h++) headers.push(`hint-${h}`)
  for (let h = 1; h <= maxHints; h++) headers.push(`hint-${h}-translation`)
  for (let h = 1; h <= maxHints; h++) headers.push(`hint-${h}-type / function`)

  const aoa: (string | number | null)[][] = []
  aoa.push([`Presentation — ${pkg.title}`])
  aoa.push([
    'Hints first; translations and explanations afterward. Fancy words are limited to 1–2 words. HC 3–4 hints are intentionally related.',
  ])
  aoa.push(headers)

  pkg.sessions.forEach((session) => {
    session.items.forEach((item) => {
      const rowData: (string | number | null)[] = [
        item.sessionNumber,
        item.itemNumber,
        item.hcTotal || item.hints.length,
      ]

      for (let h = 1; h <= maxHints; h++) {
        const hint = item.hints.find((hi) => hi.itemIndex === h) || item.hints[h - 1]
        rowData.push(hint ? hint.text : null)
      }
      for (let h = 1; h <= maxHints; h++) {
        const hint = item.hints.find((hi) => hi.itemIndex === h) || item.hints[h - 1]
        rowData.push(hint ? hint.translation : null)
      }
      for (let h = 1; h <= maxHints; h++) {
        const hint = item.hints.find((hi) => hi.itemIndex === h) || item.hints[h - 1]
        rowData.push(hint ? hint.typeFunction : null)
      }

      aoa.push(rowData)
    })
  })

  return aoa
}

// --------------------------------------------------------------------------
// 4. Bridge: Convert ImprovPackage to Chunks LMS Red Test Structure
// --------------------------------------------------------------------------

export interface ChunksRedTestItem {
  sessionNumber: number
  itemNumber: number
  cvrOhm: number
  cciAmps: number
  cpdVoltage: number
  trapType: string
  termEn: string
  termVi: string
  hintEn: string
  hintVi: string
  spokenScriptEn: string
  spokenScriptVi: string
  hints: ImprovHint[]
}

export function mapImprovToRedTest(
  pkg: ImprovPackage,
  voltageTarget: 36 | 56 = 56,
): ChunksRedTestItem[] {
  const result: ChunksRedTestItem[] = []

  pkg.sessions.forEach((session) => {
    const s = session.sessionNumber
    // Standard progression:
    const cvr = session.targetCvrOhm || (voltageTarget === 36
      ? [1, 2, 3, 5, 7, 9, 11][s - 1] || 5
      : [1, 3, 5, 7, 9, 11, 13][s - 1] || 7)
    const cci = session.cciAmps || (voltageTarget === 36
      ? [2, 2, 4, 4, 4, 6, 6][s - 1] || 4
      : [2, 2, 4, 4, 4, 6, 8][s - 1] || 4)
    const cpd = cvr * cci

    session.items.forEach((item) => {
      const h1 = item.hints[0]
      const h2 = item.hints[1] || item.hints[0]
      const hLast = item.hints[item.hints.length - 1]

      const termEn = `${h1.text} ; ${hLast.text}`
      const termVi = `${h1.translation} ; ${hLast.translation}`

      // Injects 650ms SSML audio break
      const ssmlEn = `<speak><s>${h1.text}</s> <break time="650ms"/> <s>${hLast.text}</s></speak>`
      const ssmlVi = `<speak><s>${h1.translation}</s> <break time="650ms"/> <s>${hLast.translation}</s></speak>`

      // Determine trap type from hint typeFunction
      const trapType = h2?.typeFunction || h1.typeFunction

      result.push({
        sessionNumber: s,
        itemNumber: item.itemNumber,
        cvrOhm: cvr,
        cciAmps: cci,
        cpdVoltage: cpd,
        trapType,
        termEn,
        termVi,
        hintEn: `Notice pause and transition from ${h1.text} to ${hLast.text}.`,
        hintVi: `Chú ý khoảng ngắt và chuyển nhịp từ ${h1.translation} sang ${hLast.translation}.`,
        spokenScriptEn: ssmlEn,
        spokenScriptVi: ssmlVi,
        hints: item.hints,
      })
    })
  })

  return result
}
