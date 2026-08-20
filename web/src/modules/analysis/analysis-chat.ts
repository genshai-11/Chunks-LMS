import { getSupabase } from '../../lib/supabase'

export type AnalysisChatCard = {
  title: string
  value: string
  unit?: string
  description: string
  tone?: 'good' | 'warn' | 'neutral'
}

export type AnalysisChatResult = {
  answer: string
  cards: AnalysisChatCard[]
  chartSuggestion: {
    title: string
    kind: 'line' | 'bar' | 'pie' | 'combo' | 'none'
    description: string
  } | null
  followUpQuestions: string[]
}

export type AnalysisChatContext = {
  courseCode: string
  className?: string
  scope: string
  totalResults: number
  colorCounts: Record<string, number>
  primaryMetrics: Array<{ label: string; value: string; delta?: string }>
  additionalMetrics: Array<{ label: string; value: string; sampleSize: number; definition: string }>
  sessionSeries: Array<{ label: string; metrics: Record<string, number | null> }>
}

async function readFunctionError(error: unknown, data: any): Promise<string | null> {
  const dataMessage = data?.error?.message ?? data?.error?.code ?? data?.message ?? data?.error
  if (dataMessage) return String(dataMessage)

  const context = (error as { context?: unknown })?.context
  if (context && typeof Response !== 'undefined' && context instanceof Response) {
    const response = context.clone()
    const text = await response.text().catch(() => '')
    if (!text) return null
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } | string }
      if (typeof parsed.error === 'string') return parsed.error
      return parsed.error?.message ?? parsed.error?.code ?? text
    } catch {
      return text
    }
  }
  return null
}

function normalizeResult(raw: any): AnalysisChatResult {
  const result = raw?.result ?? raw
  return {
    answer: String(result?.answer ?? 'No answer returned.'),
    cards: Array.isArray(result?.cards) ? result.cards.slice(0, 4) : [],
    chartSuggestion: result?.chartSuggestion ?? null,
    followUpQuestions: Array.isArray(result?.followUpQuestions)
      ? result.followUpQuestions.slice(0, 3).map(String)
      : [],
  }
}

export async function askAnalysisChat(input: {
  prompt: string
  context: AnalysisChatContext
}): Promise<AnalysisChatResult> {
  const sb = getSupabase() as any
  if (!sb) throw new Error('Supabase is not configured')
  const { data, error } = await sb.functions.invoke('analysis-chat', { body: input })
  if (error) {
    const functionMessage = await readFunctionError(error, data)
    throw new Error(functionMessage ? `${error.message}: ${functionMessage}` : error.message)
  }
  if (data?.error) throw new Error(String(data.error))
  return normalizeResult(data)
}
