import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPlus,
  Gauge,
  Layers3,
  ListChecks,
  Play,
  Volume2,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { listApprovedSectionVoiceIds, listTestItems, listTestSections } from '../../lib/test-packages'
import type { TestItem, TestSection } from '../../modules/catalog/test-package-catalog'
import {
  listStandaloneAssignments,
  prepareStandaloneRun,
  startStandaloneRun,
} from '../../lib/standalone-tests'

type RunMode = 'full' | 'single'
type SectionPreview = {
  section: TestSection
  itemCount: number
  voiceIds: string[]
}

function intersectVoiceIds(groups: string[][]): string[] {
  if (groups.length === 0) return []
  return groups.reduce((acc, group) => acc.filter((id) => group.includes(id))).sort()
}

export function TeacherTestSetupPage() {
  const { assignmentId, sectionId: initialSectionId } = useParams()
  const navigate = useNavigate()
  const [sections, setSections] = useState<TestSection[]>([])
  const [itemsBySection, setItemsBySection] = useState<Record<string, TestItem[]>>({})
  const [sectionId, setSectionId] = useState(initialSectionId ?? '')
  const [language, setLanguage] = useState<'vi' | 'en'>('vi')
  const [voiceId, setVoiceId] = useState('')
  const [voiceIdsBySection, setVoiceIdsBySection] = useState<Record<string, string[]>>({})
  const [runMode, setRunMode] = useState<RunMode>('full')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!assignmentId) return
    void (async () => {
      const assignments = await listStandaloneAssignments()
      if (!assignments.ok) {
        setError(assignments.error)
        return
      }
      const assignment = assignments.data.find((candidate) => candidate.id === assignmentId)
      if (!assignment) {
        setError('Standalone assignment not found')
        return
      }
      const sectionResult = await listTestSections(assignment.packageVersionId)
      if (!sectionResult.ok) {
        setError(sectionResult.error)
        return
      }
      setSections(sectionResult.data)
      setSectionId((current) =>
        sectionResult.data.some((section) => section.id === current)
          ? current
          : (sectionResult.data[0]?.id ?? ''),
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
      const results = await Promise.all(
        sections.map(async (section) => [section.id, await listApprovedSectionVoiceIds(section.id, language)] as const),
      )
      const next: Record<string, string[]> = {}
      for (const [id, result] of results) {
        if (!result.ok) {
          setError(result.error)
          continue
        }
        next[id] = result.data
      }
      setVoiceIdsBySection(next)
    })()
  }, [language, sections])

  const preview = useMemo<SectionPreview[]>(
    () =>
      sections.map((section) => ({
        section,
        itemCount: itemsBySection[section.id]?.length ?? 0,
        voiceIds: voiceIdsBySection[section.id] ?? [],
      })),
    [itemsBySection, sections, voiceIdsBySection],
  )

  const targetPreview = useMemo(
    () => (runMode === 'full' ? preview : preview.filter((item) => item.section.id === sectionId)),
    [preview, runMode, sectionId],
  )

  const approvedVoiceIds = useMemo(() => {
    if (targetPreview.length === 0) return []
    return intersectVoiceIds(targetPreview.map((item) => item.voiceIds))
  }, [targetPreview])

  useEffect(() => {
    setVoiceId((current) => (approvedVoiceIds.includes(current) ? current : (approvedVoiceIds[0] ?? '')))
  }, [approvedVoiceIds])

  const totalItemCount = useMemo(
    () => targetPreview.reduce((sum, item) => sum + item.itemCount, 0),
    [targetPreview],
  )
  const packageItemCount = useMemo(
    () => preview.reduce((sum, item) => sum + item.itemCount, 0),
    [preview],
  )

  async function prepareAndStart() {
    if (!assignmentId || targetPreview.length === 0 || !voiceId) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const startedRunIds: string[] = []
    for (const item of targetPreview) {
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
        subtitle="Review package sessions, item count, language, and audio bundle before entering the Live Test room."
      />
      <Flash message={message} error={error} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Panel
          icon={ClipboardPlus}
          title="Prepare Test Run"
          description="Use Full Package for the normal 1-1 flow. Single Session is only for focused retake/review."
          collapsible={false}
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Layers3 className="h-4 w-4 text-indigo-500" /> Sessions
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{preview.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <ListChecks className="h-4 w-4 text-emerald-500" /> Items
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{totalItemCount || packageItemCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Gauge className="h-4 w-4 text-amber-500" /> Mode
              </div>
              <div className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                {runMode === 'full' ? 'Full Package' : 'Single Session'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Volume2 className="h-4 w-4 text-purple-500" /> Audio
              </div>
              <div className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                {voiceId || 'Not ready'}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/60">
                <button
                  type="button"
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                    runMode === 'full'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setRunMode('full')}
                >
                  Full Package · {packageItemCount} items
                </button>
                <button
                  type="button"
                  className={`mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                    runMode === 'single'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setRunMode('single')}
                >
                  Single Session only
                </button>
              </div>

              <label className="field">
                Session focus
                <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      Session {section.sectionOrder} · {section.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Prompt language
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as 'vi' | 'en')}
                >
                  <option value="vi">Vietnamese Complete</option>
                  <option value="en">English Complete</option>
                </select>
              </label>
              <label className="field">
                Approved audio bundle
                <select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}>
                  <option value="">Select approved bundle</option>
                  {approvedVoiceIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="m-0 text-sm font-black text-slate-900 dark:text-white">Package preview</h3>
                  <p className="m-0 text-xs text-slate-500">
                    {runMode === 'full'
                      ? `${preview.length} sessions · ${packageItemCount} total items`
                      : `${targetPreview[0]?.itemCount ?? 0} items in selected session`}
                  </p>
                </div>
                {voiceId ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Intro bundle available
                  </span>
                ) : null}
              </div>

              {sections.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title="No Session is available" description="The assigned published Package Version has no sessions." />
              ) : (
                <div className="grid max-h-[430px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {preview.map(({ section, itemCount, voiceIds }) => {
                    const selected = runMode === 'full' || section.id === sectionId
                    const audioReady = voiceId ? voiceIds.includes(voiceId) : voiceIds.length > 0
                    return (
                      <button
                        key={section.id}
                        type="button"
                        className={`rounded-2xl border p-3 text-left transition ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200 dark:border-indigo-500/60 dark:bg-indigo-500/10 dark:ring-indigo-500/20'
                            : 'border-slate-200 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900'
                        }`}
                        onClick={() => {
                          setSectionId(section.id)
                          setRunMode('single')
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-sm text-slate-900 dark:text-white">Session {section.sectionOrder}</strong>
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-white dark:text-slate-950">
                            {itemCount} Q
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                          {section.title || 'Untitled session'}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold">
                          <span className="text-slate-500">CVR {section.targetCvrOhm ?? '—'}</span>
                          <span className={audioReady ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}>
                            {audioReady ? 'Audio ready' : 'No intro audio'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <p className="banner-inline mt-5">
            <Volume2 className="h-4 w-4" />
            Start validates approved intro + item audio for every selected session before entering the run.
          </p>
          {targetPreview.length > 0 && approvedVoiceIds.length === 0 ? (
            <p className="banner-inline warning">
              <AlertTriangle className="h-4 w-4" />
              No common approved {language.toUpperCase()} audio bundle is available for the selected {runMode === 'full' ? 'package' : 'session'}.
            </p>
          ) : null}

          <div className="btn-row mt-4">
            <button
              className="primary"
              disabled={busy || !assignmentId || !voiceId || targetPreview.length === 0}
              onClick={() => void prepareAndStart()}
            >
              <Play className="h-4 w-4" />
              {busy
                ? 'Preparing…'
                : runMode === 'full'
                  ? `Start Full Package · ${totalItemCount} items`
                  : `Start Session ${targetPreview[0]?.section.sectionOrder ?? ''} · ${totalItemCount} items`}
            </button>
            <button className="ghost" onClick={() => navigate('/teacher/tests')}>
              Cancel
            </button>
          </div>
        </Panel>
      </div>
    </>
  )
}
