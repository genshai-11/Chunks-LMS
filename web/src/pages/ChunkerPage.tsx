import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  Play,
  RefreshCcw,
  Save,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { Flash } from '../components/Flash'
import { PageHeader } from '../components/PageHeader'
import { UserAvatar } from '../components/UserAvatar'
import { EmptyState, Panel, StatCard } from '../components/ui'
import { useFlash } from '../hooks/useFlash'
import {
  addLearnerProfile,
  deleteUserProfile,
  enrollLearner,
  listActiveLearners,
  updateUserProfile,
} from '../modules/roster/service'
import {
  completeLearningSession,
  startLearningSession,
} from '../modules/scheduling/session-lifecycle'
import { formatPercent, learnerRfcStats, summarizeLearnerSessions } from '../modules/teacher/learner-insights'
import { saveWorkspaceToSupabase } from '../lib/supabase-sync'
import { useAppState } from '../state/useAppState'
import type { ResultRecord } from '../modules/reporting/progress'
import type { RosterState } from '../modules/roster/types'
import type { SchedulingState } from '../modules/scheduling/types'

function sessionTitle(startedAt: string, index: number) {
  return `Session ${index + 1} · ${new Date(startedAt).toLocaleString()}`
}

function MiniSessionChart({ rows }: { rows: ReturnType<typeof summarizeLearnerSessions> }) {
  const ordered = rows.slice().reverse()
  if (ordered.length === 0) {
    return <p className="meta">No session data yet.</p>
  }
  return (
    <div className="chunker-chart" aria-label="Learner RFC trend">
      {ordered.map((row) => {
        const h = row.rfc == null ? 8 : Math.max(8, Math.round(row.rfc * 100))
        return (
          <div key={row.learningSessionId} className="chunker-chart-bar-wrap" title={`${row.label}: ${formatPercent(row.rfc)}`}>
            <span className="chunker-chart-bar" style={{ height: `${h}%` }} />
            <small>{row.label.replace('Session ', 'S')}</small>
          </div>
        )
      })}
    </div>
  )
}

export function ChunkerPage() {
  const {
    roster,
    setRoster,
    scheduling,
    setScheduling,
    ledger,
    setLedger,
    reloadFromSupabase,
    backendStatus,
    backendError,
    setActiveClassId,
  } = useAppState()
  const navigate = useNavigate()
  const { message, error, ok, err } = useFlash()
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftEmail, setDraftEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [classId, setClassId] = useState('')
  const [saving, setSaving] = useState(false)

  const learners = useMemo(() => listActiveLearners(roster), [roster])
  const selectedLearner = learners.find((learner) => learner.id === selectedLearnerId) ?? learners[0] ?? null
  const effectiveLearnerId = selectedLearner?.id ?? null
  const activeClasses = roster.classes.filter((row) => row.status === 'active')
  const selectedClass = activeClasses.find((row) => row.id === classId) ?? activeClasses[0] ?? null
  const selectedCourse = selectedClass ? roster.courses.find((course) => course.id === selectedClass.courseId) ?? null : null
  const learnerRows = effectiveLearnerId
    ? summarizeLearnerSessions({ ledger, scheduling, learnerUserId: effectiveLearnerId })
    : []
  const rfcStats = learnerRfcStats(learnerRows)
  const learnerSessions = effectiveLearnerId
    ? scheduling.learningSessions
        .filter((session) => {
          const participants = session.participantLearnerIds
          if (participants?.length) return participants.includes(effectiveLearnerId)
          return ledger.some(
            (record) => record.learningSessionId === session.id && record.learnerUserId === effectiveLearnerId,
          )
        })
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    : []

  async function persist(nextRoster: RosterState, nextScheduling: SchedulingState, nextLedger: ResultRecord[] = ledger, pruneMissing = false) {
    setRoster(nextRoster)
    setScheduling(nextScheduling)
    setLedger(nextLedger)
    setSaving(true)
    try {
      const result = await saveWorkspaceToSupabase(
        { roster: nextRoster, scheduling: nextScheduling },
        { pruneMissing },
      )
      if (!result.ok) {
        err(`Saved local only: ${result.error}`)
        return false
      }
      ok('Saved to database')
      return true
    } finally {
      setSaving(false)
    }
  }

  async function addLearner() {
    const result = addLearnerProfile(roster, { displayName: draftName, email: draftEmail })
    if (!result.ok) return err(result.error)
    setDraftName('')
    setDraftEmail('')
    setSelectedLearnerId(result.value.id)
    setEditName(result.value.displayName)
    setEditEmail(result.value.email ?? '')
    await persist(result.state, scheduling)
  }

  async function saveLearner() {
    if (!effectiveLearnerId) return
    const result = updateUserProfile(roster, effectiveLearnerId, {
      displayName: editName || selectedLearner?.displayName,
      email: editEmail || selectedLearner?.email,
    })
    if (!result.ok) return err(result.error)
    await persist(result.state, scheduling)
  }

  async function removeLearner() {
    if (!selectedLearner) return
    if (!window.confirm(`Delete learner ${selectedLearner.displayName}? This removes their enrollments and local session links.`)) return
    const result = deleteUserProfile(roster, selectedLearner.id)
    if (!result.ok) return err(result.error)
    const nextScheduling: SchedulingState = {
      ...scheduling,
      attendance: scheduling.attendance.filter((row) => row.learnerUserId !== selectedLearner.id),
      learningSessions: scheduling.learningSessions
        .map((session) => {
          if (!session.participantLearnerIds?.includes(selectedLearner.id)) return session
          const nextParticipants = session.participantLearnerIds.filter((id) => id !== selectedLearner.id)
          return nextParticipants.length > 0
            ? { ...session, participantLearnerIds: nextParticipants }
            : null
        })
        .filter((session): session is SchedulingState['learningSessions'][number] => Boolean(session)),
    }
    const nextLedger = ledger.filter((row) => row.learnerUserId !== selectedLearner.id)
    setSelectedLearnerId(null)
    await persist(result.state, nextScheduling, nextLedger, true)
  }

  async function assignSelectedClass() {
    if (!effectiveLearnerId || !selectedClass) return err('Select learner and class first')
    const result = enrollLearner(roster, selectedClass.id, effectiveLearnerId)
    if (!result.ok) return err(result.error)
    await persist(result.state, scheduling)
  }

  async function quickStartSession(andObserve = false) {
    if (!effectiveLearnerId || !selectedClass) return err('Select learner and class first')
    let nextRoster = roster
    if (!roster.enrollments.some((row) => row.classId === selectedClass.id && row.learnerUserId === effectiveLearnerId && row.status === 'active')) {
      const enrolled = enrollLearner(roster, selectedClass.id, effectiveLearnerId)
      if (!enrolled.ok) return err(enrolled.error)
      nextRoster = enrolled.state
    }
    const teacher = roster.users.find((user) => user.id === selectedClass.teacherUserId)
    const started = startLearningSession(scheduling, {
      classId: selectedClass.id,
      ownerUserId: teacher?.id ?? null,
      participantLearnerIds: [effectiveLearnerId],
      sessionKind: 'regular',
    })
    if (!started.ok) return err(started.error)
    const saved = await persist(nextRoster, started.state)
    if (saved) {
      if (andObserve) {
        setActiveClassId(selectedClass.id)
        navigate('/teacher/observe?from=chunker')
      } else {
        ok('Quick session started — staying on Chunker')
      }
    }
  }

  async function completeSession(sessionId: string) {
    if (!effectiveLearnerId) return
    const result = completeLearningSession(scheduling, sessionId, [effectiveLearnerId])
    if (!result.ok) return err(result.error)
    await persist(roster, result.state)
  }

  async function deleteSession(sessionId: string) {
    if (!window.confirm('Delete this session row and its local report rows?')) return
    const nextScheduling: SchedulingState = {
      scheduledSessions: scheduling.scheduledSessions,
      learningSessions: scheduling.learningSessions.filter((row) => row.id !== sessionId),
      attendance: scheduling.attendance.filter((row) => row.learningSessionId !== sessionId),
    }
    const nextLedger = ledger.filter((row) => row.learningSessionId !== sessionId)
    await persist(roster, nextScheduling, nextLedger, true)
  }

  return (
    <main className="chunker-page">
      <PageHeader
        icon={ClipboardList}
        kicker="No-login quick console"
        title="Chunker"
        subtitle="Create learners, assign existing course/class labels, start quick sessions, and review learner progress without entering live resume."
        actions={
          <div className="page-actions">
            <button type="button" className="ghost" onClick={() => void reloadFromSupabase()} disabled={saving}>
              <RefreshCcw className="h-4 w-4" aria-hidden />
              Reload DB
            </button>
            <span className="badge">{saving ? 'Saving…' : backendStatus}</span>
          </div>
        }
      />
      <Flash message={message} error={error ?? backendError} />

      <div className="stat-grid">
        <StatCard icon={Users} label="Learners" value={learners.length} hint="Loaded from workspace" />
        <StatCard icon={ClipboardList} label="Learner sessions" value={learnerSessions.length} hint={selectedLearner?.displayName ?? 'Select learner'} />
        <StatCard icon={BarChart3} label="RFC avg" value={formatPercent(rfcStats.avg)} hint="Red/yellow concentration" />
        <StatCard icon={BookOpen} label="Classes" value={activeClasses.length} hint="Existing course/class labels" />
      </div>

      <div className="chunker-grid">
        <Panel icon={UserPlus} title="Learners" description="Add, edit, delete, and select learner profiles." collapsible={false}>
          <div className="teacher-add-learner">
            <label>
              Learner name
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Learner name" />
            </label>
            <label>
              Email
              <input value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} placeholder="learner@example.com" />
            </label>
            <button type="button" className="primary" onClick={() => void addLearner()} disabled={saving}>
              <UserPlus className="h-4 w-4" aria-hidden /> Add
            </button>
          </div>
          <div className="chunker-list">
            {learners.map((learner) => (
              <button
                key={learner.id}
                type="button"
                className={`chunker-learner-row${learner.id === effectiveLearnerId ? ' is-active' : ''}`}
                onClick={() => {
                  setSelectedLearnerId(learner.id)
                  setEditName(learner.displayName)
                  setEditEmail(learner.email ?? '')
                }}
              >
                <UserAvatar name={learner.displayName} avatarUrl={learner.avatarUrl} size="sm" />
                <span>
                  <strong>{learner.displayName}</strong>
                  <small>{learner.email ?? 'No email'}</small>
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel icon={Edit3} title="Learner editor + quick actions" description="Assign a current class/course label and start sessions without opening Observe." collapsible={false}>
          {selectedLearner ? (
            <>
              <div className="form-grid">
                <label>
                  Name
                  <input value={editName || selectedLearner.displayName} onChange={(event) => setEditName(event.target.value)} />
                </label>
                <label>
                  Email
                  <input value={editEmail || (selectedLearner.email ?? '')} onChange={(event) => setEditEmail(event.target.value)} />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Existing class / course
                  <select value={selectedClass?.id ?? ''} onChange={(event) => setClassId(event.target.value)}>
                    {activeClasses.length === 0 ? <option value="">No active classes</option> : null}
                    {activeClasses.map((klass) => {
                      const course = roster.courses.find((row) => row.id === klass.courseId)
                      return (
                        <option key={klass.id} value={klass.id}>
                          {course?.code ?? 'Course'} · {klass.name}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label>
                  Course
                  <input readOnly value={selectedCourse ? `${selectedCourse.code} · ${selectedCourse.name}` : '—'} />
                </label>
              </div>
              <div className="btn-row">
                <button type="button" className="primary" onClick={() => void saveLearner()} disabled={saving}>
                  <Save className="h-4 w-4" aria-hidden /> Save learner
                </button>
                <button type="button" className="ghost" onClick={() => void assignSelectedClass()} disabled={saving || !selectedClass}>
                  <BookOpen className="h-4 w-4" aria-hidden /> Assign class
                </button>
                <button type="button" className="primary" onClick={() => void quickStartSession(true)} disabled={saving || !selectedClass}>
                  <Play className="h-4 w-4" aria-hidden /> Start & Observe
                </button>
                <button type="button" className="primary" onClick={() => void quickStartSession(false)} disabled={saving || !selectedClass}>
                  <Play className="h-4 w-4" aria-hidden /> Start quick session
                </button>
                <button type="button" className="ghost danger" onClick={() => void removeLearner()} disabled={saving}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete learner
                </button>
              </div>
            </>
          ) : (
            <EmptyState title="No learner selected" description="Create or select a learner first." />
          )}
        </Panel>
      </div>

      <Panel icon={ClipboardList} title="Sessions" description="Add, complete, delete, and inspect learner sessions without live resume." collapsible={false}>
        {learnerSessions.length === 0 ? (
          <EmptyState title="No sessions yet" description="Use Start quick session above." />
        ) : (
          <div className="table-wrap">
            <table aria-label="Chunker learner sessions">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {learnerSessions.map((session, index) => (
                  <tr key={session.id}>
                    <td>{sessionTitle(session.startedAt, learnerSessions.length - index - 1)}</td>
                    <td>{session.status}</td>
                    <td>{new Date(session.startedAt).toLocaleString()}</td>
                    <td>{session.completedAt ? new Date(session.completedAt).toLocaleString() : '—'}</td>
                    <td>
                      <div className="btn-row my-0">
                        {session.status === 'open' ? (
                          <>
                            <button type="button" className="ghost" onClick={() => {
                              setActiveClassId(session.classId)
                              navigate('/teacher/observe?from=chunker')
                            }}>
                              <Eye className="h-4 w-4" aria-hidden /> Observe
                            </button>
                            <button type="button" className="primary" onClick={() => void completeSession(session.id)}>
                              <CheckCircle2 className="h-4 w-4" aria-hidden /> Complete
                            </button>
                          </>
                        ) : null}
                        <button type="button" className="ghost danger" onClick={() => void deleteSession(session.id)}>
                          <Trash2 className="h-4 w-4" aria-hidden /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel icon={BarChart3} title="Learner report" description="Progress, chart, and learner summary for the selected learner." collapsible={false}>
        {selectedLearner ? (
          <div className="chunker-report">
            <div className="chunker-report-head">
              <UserAvatar name={selectedLearner.displayName} avatarUrl={selectedLearner.avatarUrl} size="lg" />
              <div>
                <h2>{selectedLearner.displayName}</h2>
                <p className="meta">{selectedLearner.email ?? 'No email'} · {learnerRows.length} session row(s)</p>
              </div>
            </div>
            <div className="stat-grid">
              <StatCard label="RFC min" value={formatPercent(rfcStats.min)} />
              <StatCard label="RFC max" value={formatPercent(rfcStats.max)} />
              <StatCard label="RFC avg" value={formatPercent(rfcStats.avg)} />
              <StatCard label="Sessions with data" value={rfcStats.count} />
            </div>
            <MiniSessionChart rows={learnerRows} />
            <div className="table-wrap">
              <table aria-label="Chunker report rows">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Status</th>
                    <th>Red</th>
                    <th>Yellow</th>
                    <th>Green</th>
                    <th>Purple</th>
                    <th>RFC</th>
                    <th>Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {learnerRows.map((row) => (
                    <tr key={row.learningSessionId}>
                      <td>{row.label}</td>
                      <td>{row.status}</td>
                      <td>{row.red}</td>
                      <td>{row.yellow}</td>
                      <td>{row.green}</td>
                      <td>{row.purple}</td>
                      <td>{formatPercent(row.rfc)}</td>
                      <td>{row.scoreAvg == null ? '—' : row.scoreAvg.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState title="No learner selected" description="Select a learner to see their progress report." />
        )}
      </Panel>
    </main>
  )
}
