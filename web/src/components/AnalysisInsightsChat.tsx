import { useEffect, useState } from 'react'
import { Bot, Loader2, MessageCircle, Pin, Send, Sparkles, Trash2, X } from 'lucide-react'
import {
  askAnalysisChat,
  type AnalysisChatContext,
  type AnalysisChatResult,
} from '../modules/analysis/analysis-chat'

type Props = {
  context: AnalysisChatContext
  storageKey: string
  title?: string
  description?: string
}

type PinnedMetricCard = AnalysisChatResult['cards'][number] & {
  id: string
  sourcePrompt: string
}

const EXAMPLE_PROMPT =
  'Tạo metric cho biết học viên này đang cải thiện ổn định hay chỉ tăng đột biến theo từng session.'

function readPinnedCards(storageKey: string): PinnedMetricCard[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.slice(0, 12) : []
  } catch {
    return []
  }
}

function makePinnedId(card: AnalysisChatResult['cards'][number]): string {
  return `${Date.now()}-${card.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)}`
}

export function AnalysisInsightsChat({
  context,
  storageKey,
  title = 'Custom metric chatbot',
  description = 'Talk with the chatbot, review its draft metric cards, then confirm before adding them to this analysis view.',
}: Props) {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<AnalysisChatResult | null>(null)
  const [pinnedCards, setPinnedCards] = useState<PinnedMetricCard[]>(() =>
    readPinnedCards(storageKey),
  )
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPinnedCards(readPinnedCards(storageKey))
  }, [storageKey])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    try {
      const next = await askAnalysisChat({ prompt: trimmed, context })
      setResult(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis chat failed')
    } finally {
      setLoading(false)
    }
  }

  function pinCard(card: AnalysisChatResult['cards'][number]) {
    setPinnedCards((current) => {
      const next = [
        { ...card, id: makePinnedId(card), sourcePrompt: prompt.trim() },
        ...current,
      ].slice(0, 12)
      if (typeof window !== 'undefined')
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  function clearPinnedCard(id: string) {
    setPinnedCards((current) => {
      const next = current.filter((card) => card.id !== id)
      if (typeof window !== 'undefined')
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  return (
    <>
      {pinnedCards.length > 0 ? (
        <section className="panel border border-indigo-400/20 bg-indigo-950/20 shadow-2xl shadow-indigo-950/10">
          <div className="panel-header items-start gap-4">
            <div>
              <p className="eyebrow flex items-center gap-2 text-indigo-200">
                <Sparkles className="h-4 w-4" aria-hidden /> Confirmed custom metrics
              </p>
              <h2>Runtime metric cards</h2>
              <p className="panel-desc">
                Saved in this browser for this learner/test analysis scope.
              </p>
            </div>
          </div>
          <div className="panel-body-inner space-y-3">
            <div className="stat-grid">
              {pinnedCards.map((card) => (
                <div key={card.id} className={`stat-card is-${card.tone ?? 'neutral'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="stat-label">{card.title}</p>
                    <button
                      type="button"
                      className="ghost inline-flex items-center gap-1 px-2 py-1 text-xs"
                      onClick={() => clearPinnedCard(card.id)}
                      aria-label={`Remove ${card.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <p className="stat-value">
                    {card.value}
                    {card.unit ? (
                      <span className="text-base text-slate-400"> {card.unit}</span>
                    ) : null}
                  </p>
                  <p className="meta">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full border border-indigo-200/30 bg-indigo-600 text-white shadow-2xl shadow-indigo-950/40 transition hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-300/30"
        onClick={() => setOpen(true)}
        aria-label="Open Tests 1-1 metric chatbot"
      >
        <MessageCircle className="h-6 w-6" aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/45 p-4 sm:p-6">
          <section className="panel max-h-[88vh] w-full max-w-xl overflow-hidden border border-indigo-400/20 bg-slate-950 shadow-2xl shadow-indigo-950/30">
            <div className="panel-header items-start gap-4">
              <div>
                <p className="eyebrow flex items-center gap-2 text-indigo-200">
                  <Bot className="h-4 w-4" aria-hidden /> Tests 1-1 metric builder
                </p>
                <h2>{title}</h2>
                <p className="panel-desc">{description}</p>
              </div>
              <button
                type="button"
                className="ghost inline-flex items-center gap-1 px-2 py-1 text-xs"
                onClick={() => setOpen(false)}
                aria-label="Close metric chatbot"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="panel-body-inner max-h-[70vh] space-y-4 overflow-y-auto">
              {pinnedCards.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="stat-label">Confirmed custom metrics</p>
                    <p className="meta">
                      Saved in this browser for this learner/test analysis scope
                    </p>
                  </div>
                  <div className="stat-grid">
                    {pinnedCards.map((card) => (
                      <div key={card.id} className={`stat-card is-${card.tone ?? 'neutral'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="stat-label">{card.title}</p>
                          <button
                            type="button"
                            className="ghost inline-flex items-center gap-1 px-2 py-1 text-xs"
                            onClick={() => clearPinnedCard(card.id)}
                            aria-label={`Remove ${card.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                        <p className="stat-value">
                          {card.value}
                          {card.unit ? (
                            <span className="text-base text-slate-400"> {card.unit}</span>
                          ) : null}
                        </p>
                        <p className="meta">{card.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={EXAMPLE_PROMPT}
                  className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none transition focus:border-indigo-300/70"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="meta">
                    Context: {context.totalResults} results · {context.scope} · {context.courseCode}
                  </p>
                  <button
                    type="submit"
                    className="primary inline-flex items-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Ask chatbot
                  </button>
                </div>
              </form>

              {error ? <p className="callout warning">{error}</p> : null}

              {result ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
                    {result.answer}
                  </div>

                  {result.cards.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="stat-label">Draft metric cards</p>
                        <p className="meta">Review and confirm before adding to the screen</p>
                      </div>
                      <div className="stat-grid">
                        {result.cards.map((card, index) => (
                          <div
                            key={`${card.title}-${index}`}
                            className={`stat-card is-${card.tone ?? 'neutral'}`}
                          >
                            <p className="stat-label">{card.title}</p>
                            <p className="stat-value">
                              {card.value}
                              {card.unit ? (
                                <span className="text-base text-slate-400"> {card.unit}</span>
                              ) : null}
                            </p>
                            <p className="meta">{card.description}</p>
                            <button
                              type="button"
                              className="ghost mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs"
                              onClick={() => pinCard(card)}
                            >
                              <Pin className="h-3.5 w-3.5" aria-hidden />
                              Confirm and add metric
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {result.chartSuggestion ? (
                    <div className="rounded-2xl border border-indigo-300/20 bg-indigo-950/20 p-4">
                      <p className="stat-label">Suggested chart · {result.chartSuggestion.kind}</p>
                      <p className="text-sm font-bold text-white">{result.chartSuggestion.title}</p>
                      <p className="meta">{result.chartSuggestion.description}</p>
                    </div>
                  ) : null}

                  {result.followUpQuestions.length > 0 ? (
                    <div>
                      <p className="stat-label mb-2">Follow-up questions</p>
                      <div className="flex flex-wrap gap-2">
                        {result.followUpQuestions.map((question) => (
                          <button
                            key={question}
                            type="button"
                            className="analysis-chip"
                            onClick={() => setPrompt(question)}
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
