import { useEffect, useState } from 'react'
import { AlertTriangle, ClipboardPlus, Volume2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/ui'
import { listApprovedSectionVoiceIds, listTestSections } from '../../lib/test-packages'
import {
  listStandaloneAssignments,
  prepareStandaloneRun,
  startStandaloneRun,
} from '../../lib/standalone-tests'

export function TeacherTestSetupPage() {
  const { assignmentId, sectionId: initialSectionId } = useParams()
  const navigate = useNavigate()
  const [sections, setSections] = useState<Array<any>>([])
  const [sectionId, setSectionId] = useState(initialSectionId ?? '')
  const [language, setLanguage] = useState<'vi' | 'en'>('vi')
  const [voiceId, setVoiceId] = useState('')
  const [approvedVoiceIds, setApprovedVoiceIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!assignmentId) return
    void (async () => {
      const assignments = await listStandaloneAssignments()
      if (!assignments.ok) return setError(assignments.error)
      const assignment = assignments.data.find((candidate) => candidate.id === assignmentId)
      if (!assignment) return setError('Standalone assignment not found')
      const sectionResult = await listTestSections(assignment.packageVersionId)
      if (!sectionResult.ok) return setError(sectionResult.error)
      setSections(sectionResult.data)
      setSectionId((current) =>
        sectionResult.data.some((section) => section.id === current)
          ? current
          : (sectionResult.data[0]?.id ?? ''),
      )
    })()
  }, [assignmentId])

  useEffect(() => {
    if (!sectionId) return
    void listApprovedSectionVoiceIds(sectionId, language).then((result) => {
      if (!result.ok) return setError(result.error)
      setApprovedVoiceIds(result.data)
      setVoiceId((current) => (result.data.includes(current) ? current : (result.data[0] ?? '')))
    })
  }, [language, sectionId])

  async function prepareAndStart(fullPackage = true) {
    if (!assignmentId || sections.length === 0) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const targetSections = fullPackage ? sections : sections.filter((s) => s.id === sectionId)
    const startedRunIds: string[] = []

    for (const sec of targetSections) {
      const run = await prepareStandaloneRun(assignmentId, sec.id, language, voiceId)
      if (run.ok && run.data.canStart) {
        const started = await startStandaloneRun(run.data.runId, run.data.readinessToken)
        if (started.ok) {
          startedRunIds.push(run.data.runId)
        }
      }
    }

    setBusy(false)
    if (startedRunIds.length === 0) {
      // Fallback single run check
      const singleRun = await prepareStandaloneRun(
        assignmentId,
        sectionId || sections[0]?.id,
        language,
        voiceId,
      )
      if (!singleRun.ok) return setError(singleRun.error)
      if (!singleRun.data.canStart) {
        return setMessage(
          `Run requires approved narration. Current count: ${singleRun.data.approvedItemAudioCount}/10 for ${language.toUpperCase()} / ${voiceId}.`,
        )
      }
      const started = await startStandaloneRun(singleRun.data.runId, singleRun.data.readinessToken)
      if (!started.ok) return setError(started.error)
      startedRunIds.push(singleRun.data.runId)
    }

    navigate(`/teacher/test-runs/${startedRunIds[0]}?assignmentId=${assignmentId}`)
  }

  return (
    <>
      <PageHeader
        icon={ClipboardPlus}
        kicker="Teacher · One-to-one Tests"
        title="Prepare Full Package Test Run"
        subtitle="Choose approved language/voice bundle to start the continuous Full Package Test Room."
      />
      <Flash message={message} error={error} />
      <Panel
        icon={ClipboardPlus}
        title="Run setup"
        description="This standalone flow does not use Classes, Enrollments, or Live Sessions."
        collapsible={false}
      >
        <div className="form-grid">
          <label className="field">
            Session Focus
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
            Approved TTS model / voice
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
        <p className="banner-inline">
          <Volume2 className="h-4 w-4" />
          Start requires approved intro plus item audios for this exact language and voice.
        </p>
        {sections.length === 0 ? (
          <p className="banner-inline warning">
            <AlertTriangle className="h-4 w-4" />
            No Session is available in the assigned published Package Version.
          </p>
        ) : null}
        {sectionId && approvedVoiceIds.length === 0 ? (
          <p className="banner-inline warning">
            <AlertTriangle className="h-4 w-4" />
            No approved {language.toUpperCase()} audio model is available for this Session.
          </p>
        ) : null}
        <div className="btn-row">
          <button
            className="primary"
            disabled={busy || !assignmentId || !voiceId}
            onClick={() => void prepareAndStart(true)}
          >
            {busy ? 'Preparing Full Package…' : 'Start Full Package Run'}
          </button>
          <button
            className="ghost"
            disabled={busy || !assignmentId || !sectionId || !voiceId}
            onClick={() => void prepareAndStart(false)}
          >
            Start Single Session Only
          </button>
          <button className="ghost" onClick={() => navigate('/teacher/tests')}>
            Cancel
          </button>
        </div>
      </Panel>
    </>
  )
}
