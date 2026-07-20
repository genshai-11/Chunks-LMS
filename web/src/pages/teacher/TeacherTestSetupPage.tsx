import { useEffect, useState } from 'react'
import { AlertTriangle, ClipboardPlus, Volume2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/ui'
import { listTestSections } from '../../lib/test-packages'
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
  const [voiceId, setVoiceId] = useState('alloy')
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

  async function prepareAndStart() {
    if (!assignmentId || !sectionId) return
    setBusy(true)
    setError(null)
    setMessage(null)
    const run = await prepareStandaloneRun(assignmentId, sectionId, language, voiceId)
    if (!run.ok) {
      setBusy(false)
      return setError(run.error)
    }
    if (!run.data.canStart) {
      setBusy(false)
      setMessage(
        `Run is not ready: intro approval plus 10/10 current item audios are required. Current item count: ${run.data.approvedItemAudioCount}/10 for ${language.toUpperCase()} / ${voiceId}.`,
      )
      return
    }
    const started = await startStandaloneRun(run.data.runId, run.data.readinessToken)
    setBusy(false)
    if (!started.ok) return setError(started.error)
    navigate(`/teacher/tests/run/${run.data.runId}`)
  }

  return (
    <>
      <PageHeader
        icon={ClipboardPlus}
        kicker="Teacher · One-to-one Tests"
        title="Prepare Test Run"
        subtitle="Choose one Session and one approved language/voice bundle for this existing Learner assignment."
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
            Session
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
            Approved voice
            <input value={voiceId} onChange={(event) => setVoiceId(event.target.value)} />
          </label>
        </div>
        <p className="banner-inline">
          <Volume2 className="h-4 w-4" />
          Start requires one approved current intro plus ten approved current item audios for this
          exact language and voice.
        </p>
        {sections.length === 0 ? (
          <p className="banner-inline warning">
            <AlertTriangle className="h-4 w-4" />
            No Session is available in the assigned published Package Version.
          </p>
        ) : null}
        <div className="btn-row">
          <button
            className="primary"
            disabled={busy || !assignmentId || !sectionId}
            onClick={() => void prepareAndStart()}
          >
            {busy ? 'Checking 11/11 readiness…' : 'Check readiness & start'}
          </button>
          <button className="ghost" onClick={() => navigate('/teacher/tests')}>
            Cancel
          </button>
        </div>
      </Panel>
    </>
  )
}
