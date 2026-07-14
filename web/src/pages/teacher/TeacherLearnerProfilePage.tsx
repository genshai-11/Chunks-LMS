import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, Eye, EyeOff, ImagePlus, Play, Save, UserRound } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel, StatCard } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { updateUserProfile } from '../../modules/roster/service'
import {
  formatPercent,
  learnerRfcStats,
  summarizeLearnerSessions,
} from '../../modules/teacher/learner-insights'
import { useAppState } from '../../state/useAppState'

const DEFAULT_COLUMNS = {
  date: true,
  red: true,
  yellow: true,
  green: true,
  purple: true,
  total: true,
  rfc: true,
  scoreAvg: false,
  probeTotal: false,
}

type ColumnKey = keyof typeof DEFAULT_COLUMNS

const COLUMN_LABELS: Record<ColumnKey, string> = {
  date: 'Date',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  purple: 'Purple',
  total: 'Total',
  rfc: 'RFC',
  scoreAvg: 'Score avg',
  probeTotal: 'Probe n',
}

export function TeacherLearnerProfilePage() {
  const { learnerId } = useParams()
  const navigate = useNavigate()
  const { roster, scheduling, ledger, setRoster, syncNow, setActiveLearnerUserId } = useAppState()
  const { classRow, course } = useTeacherClassContext()
  const { message, error, ok, err } = useFlash()
  const learner = roster.users.find((u) => u.id === learnerId)
  const [name, setName] = useState(learner?.displayName ?? '')
  const [email, setEmail] = useState(learner?.email ?? '')
  const [avatarUrl, setAvatarUrl] = useState(learner?.avatarUrl ?? '')
  const [showTable, setShowTable] = useState(true)
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)

  useEffect(() => {
    setName(learner?.displayName ?? '')
    setEmail(learner?.email ?? '')
    setAvatarUrl(learner?.avatarUrl ?? '')
  }, [learner?.displayName, learner?.email, learner?.avatarUrl, learner?.id])

  const rows = useMemo(
    () =>
      learnerId
        ? summarizeLearnerSessions({
            ledger,
            scheduling,
            learnerUserId: learnerId,
            classId: classRow?.id,
          })
        : [],
    [classRow?.id, learnerId, ledger, scheduling],
  )
  const stats = learnerRfcStats(rows)

  if (!learner || !learnerId) {
    return (
      <EmptyState
        icon={UserRound}
        title="Learner not found"
        description="Go back to the Teacher learner list and choose a learner."
        action={
          <Link to="/teacher" className="btn ghost">
            Back to learners
          </Link>
        }
      />
    )
  }

  async function saveProfile() {
    if (!learner) return
    const result = updateUserProfile(roster, learner.id, {
      displayName: name,
      email,
      avatarUrl,
    })
    if (!result.ok) return err(result.error)
    setRoster(result.state)
    await syncNow({ roster: result.state })
    ok('Learner profile saved')
  }

  function toggleColumn(key: ColumnKey) {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function changeImage(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  return (
    <>
      <PageHeader
        icon={UserRound}
        kicker={course?.code ?? 'Learner profile'}
        title={learner.displayName}
        subtitle="Simple profile, editable contact info, session color totals, and RFC min / max / avg."
        actions={
          <div className="page-actions">
            <button type="button" className="ghost" onClick={() => navigate('/teacher')}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span>Back</span>
            </button>
            <Link
              to={`/teacher/session?learner=${encodeURIComponent(learner.id)}`}
              className="btn primary"
              onClick={() => setActiveLearnerUserId(learner.id)}
            >
              <Play className="h-4 w-4" aria-hidden />
              <span>Start session</span>
            </Link>
          </div>
        }
      />
      <Flash message={message} error={error} />

      <div className="teacher-profile-grid">
        <Panel
          icon={UserRound}
          title="Profile"
          description="Teacher can update learner name/email."
        >
          <div className="teacher-profile-card">
            <UserAvatar name={learner.displayName} avatarUrl={avatarUrl || learner.avatarUrl} size="xl" />
            <label>
              Change image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => changeImage(event.target.files?.[0] ?? null)}
              />
            </label>
            <label>
              Image URL
              <input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://... or upload image"
              />
            </label>
            {avatarUrl ? (
              <button type="button" className="ghost" onClick={() => setAvatarUrl('')}>
                <ImagePlus className="h-4 w-4" aria-hidden />
                Remove image
              </button>
            ) : null}
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <button type="button" className="primary" onClick={saveProfile}>
              <Save className="h-4 w-4" aria-hidden />
              Save profile
            </button>
          </div>
        </Panel>

        <Panel
          icon={BarChart3}
          title="RFC summary"
          description="RFC = (Red + Yellow) / total finalized observations per session."
        >
          <div className="stat-grid compact">
            <StatCard
              icon={BarChart3}
              label="RFC min"
              value={formatPercent(stats.min)}
              hint="Best session"
            />
            <StatCard
              icon={BarChart3}
              label="RFC max"
              value={formatPercent(stats.max)}
              hint="Needs most support"
            />
            <StatCard
              icon={BarChart3}
              label="RFC avg"
              value={formatPercent(stats.avg)}
              hint={`${stats.count} session(s)`}
            />
          </div>
        </Panel>
      </div>

      <Panel
        icon={BarChart3}
        title="Session detail table"
        description="Show/hide the table and choose columns. Example: red: 1, yellow: 2, purple: 10, total session: 13."
        actions={
          <button type="button" className="ghost" onClick={() => setShowTable((value) => !value)}>
            {showTable ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
            <span>{showTable ? 'Hide table' : 'Show table'}</span>
          </button>
        }
      >
        <div className="column-toggle-row" aria-label="Table columns">
          {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={columns[key] ? 'active' : 'ghost'}
              onClick={() => toggleColumn(key)}
              title={`Toggle ${COLUMN_LABELS[key]} column`}
            >
              {COLUMN_LABELS[key]}
            </button>
          ))}
        </div>

        {showTable ? (
          rows.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No session data yet"
              description="Start a session for this learner and finalize observations to populate color totals."
            />
          ) : (
            <div className="table-wrap learner-session-table-wrap">
              <table aria-label="Learner session color totals">
                <thead>
                  <tr>
                    <th scope="col">Session</th>
                    {columns.date ? <th scope="col">Date</th> : null}
                    {columns.red ? <th scope="col">Red</th> : null}
                    {columns.yellow ? <th scope="col">Yellow</th> : null}
                    {columns.green ? <th scope="col">Green</th> : null}
                    {columns.purple ? <th scope="col">Purple</th> : null}
                    {columns.total ? <th scope="col">Total session</th> : null}
                    {columns.rfc ? (
                      <th scope="col" title="(Red + Yellow) / total">
                        RFC
                      </th>
                    ) : null}
                    {columns.scoreAvg ? <th scope="col">Score avg</th> : null}
                    {columns.probeTotal ? <th scope="col">Probe n</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.learningSessionId}>
                      <th scope="row">{row.label}</th>
                      {columns.date ? (
                        <td>{new Date(row.startedAt).toLocaleDateString()}</td>
                      ) : null}
                      {columns.red ? (
                        <td className="font-mono text-xs tabular-nums">{row.red}</td>
                      ) : null}
                      {columns.yellow ? (
                        <td className="font-mono text-xs tabular-nums">{row.yellow}</td>
                      ) : null}
                      {columns.green ? (
                        <td className="font-mono text-xs tabular-nums">{row.green}</td>
                      ) : null}
                      {columns.purple ? (
                        <td className="font-mono text-xs tabular-nums">{row.purple}</td>
                      ) : null}
                      {columns.total ? (
                        <td className="font-mono text-xs tabular-nums">{row.total}</td>
                      ) : null}
                      {columns.rfc ? (
                        <td className="font-mono text-xs tabular-nums">{formatPercent(row.rfc)}</td>
                      ) : null}
                      {columns.scoreAvg ? (
                        <td className="font-mono text-xs tabular-nums">
                          {row.scoreAvg == null ? '—' : row.scoreAvg.toFixed(1)}
                        </td>
                      ) : null}
                      {columns.probeTotal ? (
                        <td className="font-mono text-xs tabular-nums">{row.probeTotal}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p className="meta">Table hidden. Use “Show table” when you need detailed columns.</p>
        )}
      </Panel>
    </>
  )
}
