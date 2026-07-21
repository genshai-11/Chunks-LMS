import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPlus,
  Gauge,
  Layers3,
  ListChecks,
  Play,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import {
  listApprovedSectionVoiceIds,
  listSectionNarrationReview,
  listTestItems,
  listTestSections,
} from '../../lib/test-packages'
import type { TestItem, TestSection } from '../../modules/catalog/test-package-catalog'
import { generateNarration } from '../../modules/catalog/live-test-generation'
import {
  audioReadiness,
  audioTargetStatus,
  narrationSourceHash,
  resolveItemSpokenScript,
  resolveNarrationRecord,
  type AudioLanguage,
  type AudioTargetStatus,
} from '../../modules/catalog/spoken-scripts'
import {
  listStandaloneAssignments,
  prepareStandaloneRun,
  startStandaloneRun,
} from '../../lib/standalone-tests'

type RunMode = 'single' | 'multi' | 'full'
type SectionPreview = {
  section: TestSection
  itemCount: number
  viVoiceIds: string[]
  enVoiceIds: string[]
}
type AudioStatusSummary = {
  vi: ReturnType<typeof audioReadiness>
  en: ReturnType<typeof audioReadiness>
}

function defaultLanguageForSection(section: TestSection): AudioLanguage {
  return section.sectionOrder <= 4 ? 'vi' : 'en'
}

function intersectVoiceIds(groups: string[][]): string[] {
  const nonEmpty = groups.filter((group) => group.length > 0)
  if (nonEmpty.length === 0) return []
  return nonEmpty.reduce((acc, group) => acc.filter((id) => group.includes(id))).sort()
}

async function sectionAudioStatuses(input: {
  packageVersionId: string
  section: TestSection
  items: TestItem[]
  language: AudioLanguage
  voiceId: string
}): Promise<AudioTargetStatus[]> {
  const review = await listSectionNarrationReview({
    packageVersionId: input.packageVersionId,
    sectionId: input.section.id,
    itemIds: input.items.map((item) => item.id),
    language: input.language,
    voiceId: input.voiceId,
  })
  if (!review.ok) return Array(input.items.length + 1).fill('missing')
  const introText = input.language === 'vi' ? input.section.introTextVi : input.section.introTextEn
  const introHash = introText ? await narrationSourceHash(introText, input.language, input.voiceId) : undefined
  const statuses: AudioTargetStatus[] = [
    audioTargetStatus(resolveNarrationRecord(review.data, `section:${input.section.id}`, introHash), introHash),
  ]
  for (const item of input.items) {
    const prompt = input.language === 'vi' ? item.promptVi : item.promptEn
    const script = prompt
      ? resolveItemSpokenScript({ itemOrder: item.itemOrder, prompt, language: input.language })
      : ''
    const hash = script ? await narrationSourceHash(script, input.language, input.voiceId) : undefined
    statuses.push(audioTargetStatus(resolveNarrationRecord(review.data, `item:${item.id}`, hash), hash))
  }
  return statuses
}

export function TeacherTestSetupPage() {
  const { assignmentId, sectionId: initialSectionId } = useParams()
  const navigate = useNavigate()
  const [packageVersionId, setPackageVersionId] = useState('')
  const [sections, setSections] = useState<TestSection[]>([])
  const [itemsBySection, setItemsBySection] = useState<Record<string, TestItem[]>>({})
  const [sectionId, setSectionId] = useState(initialSectionId ?? '')
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())
  const [languageBySection, setLanguageBySection] = useState<Record<string, AudioLanguage>>({})
  const [voiceId, setVoiceId] = useState('gemini/gemini-2.5-flash-preview-tts')
  const [viVoiceIdsBySection, setViVoiceIdsBySection] = useState<Record<string, string[]>>({})
  const [enVoiceIdsBySection, setEnVoiceIdsBySection] = useState<Record<string, string[]>>({})
  const [audioSummaryBySection, setAudioSummaryBySection] = useState<Record<string, AudioStatusSummary>>({})
  const [runMode, setRunMode] = useState<RunMode>('full')
  const [busy, setBusy] = useState(false)
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadAudioSummary = useCallback(
    async (nextPackageVersionId = packageVersionId, nextSections = sections) => {
      if (!nextPackageVersionId || !voiceId || nextSections.length === 0) return
      const summaries: Record<string, AudioStatusSummary> = {}
      await Promise.all(
        nextSections.map(async (section) => {
          const items = itemsBySection[section.id] ?? []
          const [viStatuses, enStatuses] = await Promise.all([
            sectionAudioStatuses({ packageVersionId: nextPackageVersionId, section, items, language: 'vi', voiceId }),
            sectionAudioStatuses({ packageVersionId: nextPackageVersionId, section, items, language: 'en', voiceId }),
          ])
          summaries[section.id] = {
            vi: audioReadiness(viStatuses),
            en: audioReadiness(enStatuses),
          }
        }),
      )
      setAudioSummaryBySection(summaries)
    },
    [itemsBySection, packageVersionId, sections, voiceId],
  )

  useEffect(() => {
    if (!assignmentId) return
    void (async () => {
      const assignments = await listStandaloneAssignments()
      if (!assignments.ok) return setError(assignments.error)
      const assignment = assignments.data.find((candidate) => candidate.id === assignmentId)
      if (!assignment) return setError('Standalone assignment not found')
      setPackageVersionId(assignment.packageVersionId)
      const sectionResult = await listTestSections(assignment.packageVersionId)
      if (!sectionResult.ok) return setError(sectionResult.error)
      setSections(sectionResult.data)
      setSectionId((current) =>
        sectionResult.data.some((section) => section.id === current)
          ? current
          : (sectionResult.data[0]?.id ?? ''),
      )
      setSelectedSectionIds(new Set(sectionResult.data.map((section) => section.id)))
      setLanguageBySection(
        Object.fromEntries(sectionResult.data.map((section) => [section.id, defaultLanguageForSection(section)])),
      )

      const itemResults = await Promise.all(
        sectionResult.data.map(async (section) => [section.id, await listTestItems(section.id)] as const),
      )
      const nextItems: Record<string, TestItem[]> = {}
      for (const [id, result] of itemResults) {
        if (result.ok) nextItems[id] = result.data
      }
      setItemsBySection(nextItems)
    })()
  }, [assignmentId])

  useEffect(() => {
    if (sections.length === 0) return
    void (async () => {
      const [viResults, enResults] = await Promise.all([
        Promise.all(sections.map(async (section) => [section.id, await listApprovedSectionVoiceIds(section.id, 'vi')] as const)),
        Promise.all(sections.map(async (section) => [section.id, await listApprovedSectionVoiceIds(section.id, 'en')] as const)),
      ])
      const viNext: Record<string, string[]> = {}
      const enNext: Record<string, string[]> = {}
      for (const [id, result] of viResults) if (result.ok) viNext[id] = result.data
      for (const [id, result] of enResults) if (result.ok) enNext[id] = result.data
      setViVoiceIdsBySection(viNext)
      setEnVoiceIdsBySection(enNext)
    })()
  }, [sections])

  useEffect(() => {
    void loadAudioSummary()
  }, [loadAudioSummary])

  const preview = useMemo<SectionPreview[]>(
    () =>
      sections.map((section) => ({
        section,
        itemCount: itemsBySection[section.id]?.length ?? 0,
        viVoiceIds: viVoiceIdsBySection[section.id] ?? [],
        enVoiceIds: enVoiceIdsBySection[section.id] ?? [],
      })),
    [enVoiceIdsBySection, itemsBySection, sections, viVoiceIdsBySection],
  )

  const targetPreview = useMemo(() => {
    if (runMode === 'full') return preview
    if (runMode === 'single') return preview.filter((item) => item.section.id === sectionId)
    return preview.filter((item) => selectedSectionIds.has(item.section.id))
  }, [preview, runMode, sectionId, selectedSectionIds])

  const suggestedVoiceIds = useMemo(() => {
    const groups = targetPreview.map((item) => {
      const language = languageBySection[item.section.id] ?? defaultLanguageForSection(item.section)
      return language === 'vi' ? item.viVoiceIds : item.enVoiceIds
    })
    return intersectVoiceIds(groups)
  }, [languageBySection, targetPreview])

  const totalItemCount = useMemo(
    () => targetPreview.reduce((sum, item) => sum + item.itemCount, 0),
    [targetPreview],
  )
  const packageItemCount = useMemo(
    () => preview.reduce((sum, item) => sum + item.itemCount, 0),
    [preview],
  )

  function toggleSection(section: TestSection) {
    setRunMode('multi')
    setSelectedSectionIds((current) => {
      const next = new Set(current)
      if (next.has(section.id)) next.delete(section.id)
      else next.add(section.id)
      return next
    })
  }

  async function generateSectionAudio(section: TestSection, language: AudioLanguage) {
    if (!packageVersionId || !voiceId) return
    if (!window.confirm(`Generate missing ${language.toUpperCase()} audio prompts for Session ${section.sectionOrder}?`)) return
    setGeneratingSectionId(section.id)
    setError(null)
    setMessage(null)
    try {
      await generateNarration({
        packageVersionId,
        target: 'section_intro',
        testSectionId: section.id,
        language,
        voiceId,
      })
      for (const item of itemsBySection[section.id] ?? []) {
        await generateNarration({
          packageVersionId,
          target: 'test_item',
          testItemId: item.id,
          language,
          voiceId,
        })
      }
      setMessage(`Generated audio prompts for Session ${section.sectionOrder} (${language.toUpperCase()}). Review/approve before starting if required.`)
      await loadAudioSummary()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate audio prompts')
    } finally {
      setGeneratingSectionId(null)
    }
  }

  async function prepareAndStart() {
    if (!assignmentId || targetPreview.length === 0 || !voiceId) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const startedRunIds: string[] = []
    for (const item of targetPreview) {
      const language = languageBySection[item.section.id] ?? defaultLanguageForSection(item.section)
      const run = await prepareStandaloneRun(assignmentId, item.section.id, language, voiceId)
      if (!run.ok) {
        setBusy(false)
        setError(run.error)
        return
      }
      if (!run.data.canStart) {
        setBusy(false)
        setMessage(
          `Session ${item.section.sectionOrder} is not ready for ${language.toUpperCase()} / ${voiceId}. Approved item audio: ${run.data.approvedItemAudioCount}/${item.itemCount}.`,
        )
        return
      }
      const started = await startStandaloneRun(run.data.runId, run.data.readinessToken)
      if (!started.ok) {
        setBusy(false)
        setError(started.error)
        return
      }
      startedRunIds.push(run.data.runId)
    }

    setBusy(false)
    navigate(`/teacher/test-runs/${startedRunIds[0]}?assignmentId=${assignmentId}`)
  }

  return (
    <>
      <PageHeader
        icon={ClipboardPlus}
        kicker="Teacher · Tests 1-1"
        title="Run setup"
        subtitle="Review sessions, languages, item count, and audio readiness before entering the Live Test room."
      />
      <Flash message={message} error={error} />

      <Panel
        icon={ClipboardPlus}
        title="Prepare Test Run"
        description="Choose Single Session or flexible Multi-Session groups such as Session 1–4 VI and Session 5–8 EN."
        collapsible={false}
      >
        <div className="test-setup-shell">
          <div className="test-setup-side">
            <div className="test-setup-stats">
              <div><Layers3 className="h-4 w-4 text-indigo-500" /><span>Sessions</span><strong>{targetPreview.length || preview.length}</strong></div>
              <div><ListChecks className="h-4 w-4 text-emerald-500" /><span>Items</span><strong>{totalItemCount || packageItemCount}</strong></div>
              <div><Gauge className="h-4 w-4 text-amber-500" /><span>Mode</span><strong>{runMode}</strong></div>
            </div>

            <div className="test-run-mode-picker">
              {(['full', 'multi', 'single'] as RunMode[]).map((mode) => (
                <button key={mode} type="button" className={runMode === mode ? 'is-active' : ''} onClick={() => setRunMode(mode)}>
                  {mode === 'full' ? 'Full Package' : mode === 'multi' ? 'Multi-Session' : 'Single Session'}
                </button>
              ))}
            </div>

            <label className="field">
              Single session focus
              <select value={sectionId} onChange={(event) => { setSectionId(event.target.value); setRunMode('single') }}>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>Session {section.sectionOrder} · {section.title}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Audio voice/model
              <input value={voiceId} onChange={(event) => setVoiceId(event.target.value)} />
              {suggestedVoiceIds.length > 0 ? <span className="meta text-slate-600 dark:text-slate-300">Available: {suggestedVoiceIds.slice(0, 2).join(', ')}</span> : null}
            </label>
          </div>

          <div className="test-setup-main">
            <div className="test-audio-review-head">
              <div>
                <h3>Session & audio review</h3>
                <p>Each selected session can use VI or EN before the run starts.</p>
              </div>
              <span>{totalItemCount || packageItemCount} questions</span>
            </div>
            {sections.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No Session is available" description="The assigned published Package Version has no sessions." />
            ) : (
              <div className="test-audio-review-table">
                <table>
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Session</th>
                      <th>Items</th>
                      <th>Language</th>
                      <th>VI audio</th>
                      <th>EN audio</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(({ section, itemCount }) => {
                      const selected = runMode === 'full' || (runMode === 'single' ? section.id === sectionId : selectedSectionIds.has(section.id))
                      const language = languageBySection[section.id] ?? defaultLanguageForSection(section)
                      const summary = audioSummaryBySection[section.id]
                      const currentSummary = summary?.[language]
                      const ready = currentSummary?.ready ?? false
                      return (
                        <tr key={section.id} className={selected ? 'is-selected' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={runMode === 'full' || runMode === 'single'}
                              onChange={() => toggleSection(section)}
                            />
                          </td>
                          <td>
                            <button type="button" className="test-session-cell" onClick={() => { setSectionId(section.id); setRunMode('single') }}>
                              <strong>Session {section.sectionOrder}</strong>
                              <span>{section.title || 'Untitled session'}</span>
                            </button>
                          </td>
                          <td>{itemCount} Q</td>
                          <td>
                            <select
                              value={language}
                              onChange={(event) => setLanguageBySection((current) => ({ ...current, [section.id]: event.target.value as AudioLanguage }))}
                            >
                              <option value="vi">VI</option>
                              <option value="en">EN</option>
                            </select>
                          </td>
                          <td><span className={summary?.vi.ready ? 'badge success' : 'badge warning'}>{summary?.vi.approved ?? 0}/{summary?.vi.expected ?? itemCount + 1}</span></td>
                          <td><span className={summary?.en.ready ? 'badge success' : 'badge warning'}>{summary?.en.approved ?? 0}/{summary?.en.expected ?? itemCount + 1}</span></td>
                          <td>
                            {ready ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Ready</span>
                            ) : (
                              <button
                                type="button"
                                className="ghost"
                                disabled={generatingSectionId === section.id}
                                onClick={() => void generateSectionAudio(section, language)}
                              >
                                <Sparkles className="h-4 w-4" />
                                {generatingSectionId === section.id ? 'Generating…' : 'Generate Audio Prompts'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <p className="banner-inline mt-5">
          <Volume2 className="h-4 w-4" />
          Start validates approved intro + item audio for each selected session/language.
        </p>
        {targetPreview.length === 0 ? (
          <p className="banner-inline warning"><AlertTriangle className="h-4 w-4" />Select at least one session.</p>
        ) : null}

        <div className="btn-row mt-4">
          <button className="primary" disabled={busy || !assignmentId || !voiceId || targetPreview.length === 0} onClick={() => void prepareAndStart()}>
            <Play className="h-4 w-4" />
            {busy ? 'Preparing…' : `Start Test · ${targetPreview.length} sessions · ${totalItemCount} items`}
          </button>
          <button className="ghost" onClick={() => navigate('/teacher/tests')}>Cancel</button>
        </div>
      </Panel>
    </>
  )
}
