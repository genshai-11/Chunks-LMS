import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Play, RotateCcw, Volume2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import {
  getStandaloneRunRuntime,
  completeStandaloneRun,
  listStandaloneRunItems,
  recordStandaloneResult,
  resolveStandaloneProbe,
} from '../../lib/standalone-tests'
import { getNarrationPlaybackUrl } from '../../modules/catalog/live-test-generation'

type AudioState = 'idle' | 'loading' | 'ready' | 'playing' | 'played' | 'error'

export function TeacherTestRunPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState<Array<any>>([])
  const [introVariantId, setIntroVariantId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'intro' | 'items'>('intro')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioState, setAudioState] = useState<AudioState>('idle')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!runId) return
    const [runtime, itemResult] = await Promise.all([
      getStandaloneRunRuntime(runId),
      listStandaloneRunItems(runId),
    ])
    if (!runtime.ok) return setMessage(runtime.error)
    if (!itemResult.ok) return setMessage(itemResult.error)
    if (!runtime.data.introNarrationVariantId)
      return setMessage('Run is blocked: approved intro narration is missing.')
    setIntroVariantId(runtime.data.introNarrationVariantId)
    setItems(itemResult.data)
    const introPlayed = sessionStorage.getItem(`standalone-intro-played:${runId}`) === 'true'
    setPhase(introPlayed ? 'items' : 'intro')
  }, [runId])
  useEffect(() => {
    void load()
  }, [load])

  const current = useMemo(
    () =>
      items.find((item) => {
        const status = item.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots?.status
        return !['finalized', 'corrected'].includes(status)
      }),
    [items],
  )
  const completedCount = items.filter((item) =>
    ['finalized', 'corrected'].includes(
      item.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots?.status,
    ),
  ).length
  const currentVariantId =
    phase === 'intro' ? introVariantId : (current?.narration_variant_id ?? null)

  useEffect(() => {
    if (!currentVariantId) return
    setAudioUrl('')
    setAudioState('loading')
    setMessage('')
    void getNarrationPlaybackUrl(currentVariantId)
      .then((playback) => {
        setAudioUrl(playback.signedUrl)
        setAudioState('ready')
      })
      .catch((cause) => {
        setAudioState('error')
        setMessage(cause instanceof Error ? cause.message : 'Audio playback failed')
      })
  }, [currentVariantId])

  function finishAudio() {
    setAudioState('played')
    if (phase === 'intro' && runId) {
      sessionStorage.setItem(`standalone-intro-played:${runId}`, 'true')
      setPhase('items')
    }
  }

  async function record(pass: boolean) {
    if (!current || audioState !== 'played') return
    const result = await recordStandaloneResult(current.id, pass ? 'purple' : 'green')
    if (!result.ok) return setMessage(result.error)
    if (!pass) {
      const probe = await resolveStandaloneProbe(result.data.attemptId, 'fail')
      if (!probe.ok) return setMessage(probe.error)
    }
    await load()
  }

  async function complete() {
    const result = await completeStandaloneRun(runId!)
    if (result.ok) navigate('/teacher/tests')
    else setMessage(result.error)
  }

  if (items.length === 0)
    return (
      <EmptyState icon={ClipboardCheck} title="Loading frozen Test Items…" description={message} />
    )

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        kicker="One-to-one Test"
        title={
          phase === 'intro'
            ? 'Session introduction'
            : current
              ? `Item ${current.item_order}`
              : 'Session complete'
        }
        subtitle={`${completedCount}/${items.length || 10} finalized`}
      />
      <Panel
        icon={phase === 'intro' ? Volume2 : ClipboardCheck}
        title={
          phase === 'intro'
            ? 'Listen before Item 1'
            : current
              ? current.prompt_text
              : 'All ten Items finalized'
        }
        description={
          phase === 'intro'
            ? 'The approved Session intro plays once before result capture begins.'
            : current
              ? 'The approved item sentence must finish before Pass/Fail unlocks.'
              : 'Complete the immutable Run and return to Tests.'
        }
        collapsible={false}
      >
        {currentVariantId ? (
          <div className="runner-audio-gate">
            <div className="runner-audio-status">
              <Volume2 className="h-5 w-5" />
              <div>
                <strong>
                  {audioState === 'played'
                    ? 'Audio complete'
                    : audioState === 'error'
                      ? 'Audio unavailable'
                      : 'Listen to approved audio'}
                </strong>
                <div className="meta">
                  {audioState === 'loading'
                    ? 'Creating secure playback URL…'
                    : audioState === 'playing'
                      ? 'Playing…'
                      : audioState === 'played'
                        ? 'Result capture unlocked.'
                        : 'Private signed playback.'}
                </div>
              </div>
            </div>
            {audioUrl ? (
              <audio
                key={currentVariantId}
                controls
                autoPlay
                src={audioUrl}
                onPlay={() => setAudioState('playing')}
                onEnded={finishAudio}
                onError={() => setAudioState('error')}
              />
            ) : null}
            {audioState === 'error' ? (
              <button
                className="ghost"
                onClick={() => {
                  setAudioState('idle')
                  setAudioUrl('')
                  void getNarrationPlaybackUrl(currentVariantId)
                    .then((playback) => {
                      setAudioUrl(playback.signedUrl)
                      setAudioState('ready')
                    })
                    .catch((cause) =>
                      setMessage(cause instanceof Error ? cause.message : 'Playback failed'),
                    )
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Retry audio
              </button>
            ) : null}
          </div>
        ) : null}
        {message ? <p className="error-text">{message}</p> : null}
        {phase === 'items' && current ? (
          <div className="test-run-actions">
            <button
              className="primary"
              disabled={audioState !== 'played'}
              onClick={() => void record(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Pass
            </button>
            <button
              className="danger"
              disabled={audioState !== 'played'}
              onClick={() => void record(false)}
            >
              Fail + CPD probe
            </button>
            {audioState !== 'played' ? (
              <span className="meta">
                <Play className="h-3 w-3" />
                Finish the narration to unlock result capture.
              </span>
            ) : null}
          </div>
        ) : null}
        {phase === 'items' && !current ? (
          <button className="primary" onClick={() => void complete()}>
            <CheckCircle2 className="h-4 w-4" />
            Complete Run
          </button>
        ) : null}
      </Panel>
    </>
  )
}
