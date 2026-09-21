import { useMemo, useState } from 'react'
import {
  Eye,
  Home,
  LayoutGrid,
  List,
  Play,
  School,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import {
  addLearnerProfile,
  createLearnerAndEnroll,
  enrollLearner,
  listActiveLearners,
} from '../../modules/roster/service'

export const PRESET_AVATARS = [
  {
    id: 'avatar-1',
    label: 'Coral Star',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FF5E62"/><stop offset="100%" stop-color="%23FF9966"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g1)"/><circle cx="50" cy="40" r="18" fill="white" opacity="0.95"/><path d="M22 86 C24 64, 76 64, 78 86" fill="white" opacity="0.95"/></svg>',
  },
  {
    id: 'avatar-2',
    label: 'Sky Wave',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2300c6ff"/><stop offset="100%" stop-color="%230072ff"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g2)"/><circle cx="50" cy="40" r="18" fill="white" opacity="0.95"/><path d="M22 86 C24 64, 76 64, 78 86" fill="white" opacity="0.95"/></svg>',
  },
  {
    id: 'avatar-3',
    label: 'Emerald Spark',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2311998e"/><stop offset="100%" stop-color="%2338ef7d"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g3)"/><circle cx="50" cy="40" r="18" fill="white" opacity="0.95"/><path d="M22 86 C24 64, 76 64, 78 86" fill="white" opacity="0.95"/></svg>',
  },
  {
    id: 'avatar-4',
    label: 'Violet Glow',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%238A2387"/><stop offset="100%" stop-color="%23E94057"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g4)"/><circle cx="50" cy="40" r="18" fill="white" opacity="0.95"/><path d="M22 86 C24 64, 76 64, 78 86" fill="white" opacity="0.95"/></svg>',
  },
  {
    id: 'avatar-5',
    label: 'Amber Sun',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f7971e"/><stop offset="100%" stop-color="%23ffd200"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g5)"/><circle cx="50" cy="40" r="18" fill="white" opacity="0.95"/><path d="M22 86 C24 64, 76 64, 78 86" fill="white" opacity="0.95"/></svg>',
  },
  {
    id: 'avatar-6',
    label: 'Indigo Aurora',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%234A00E0"/><stop offset="100%" stop-color="%238E2DE2"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g6)"/><circle cx="50" cy="40" r="18" fill="white" opacity="0.95"/><path d="M22 86 C24 64, 76 64, 78 86" fill="white" opacity="0.95"/></svg>',
  },
]
import {
  formatPercent,
  learnerRfcStats,
  nextLearnerSessionNumber,
  summarizeLearnerSessions,
} from '../../modules/teacher/learner-insights'
import { createCaptureSession } from '../../modules/assessment/session-capture'
import {
  closeOrphanOpenSessions,
  openSessionParticipantNames,
} from '../../modules/scheduling/orphan-sessions'
import { startLearningSession } from '../../modules/scheduling/session-lifecycle'
import { useAppState } from '../../state/useAppState'

type ViewMode = 'grid' | 'list'

export function TeacherOverviewPage() {
  const {
    roster,
    setRoster,
    scheduling,
    setScheduling,
    capture,
    setCapture,
    ledger,
    metricSettings,
    activeLearnerUserId,
    setActiveLearnerUserId,
    setActiveClassId,
    syncNow,
  } = useAppState()
  const { options, classRow, course, teacher, seats, hasMultiple, selectedClassIds, mode } = useTeacherClassContext()
  const navigate = useNavigate()
  const { message, error, ok, err } = useFlash()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [startingLearnerId, setStartingLearnerId] = useState<string | null>(null)
  const [showAddLearner, setShowAddLearner] = useState(false)
  const [savingLearner, setSavingLearner] = useState(false)
  const [addLearnerDraft, setAddLearnerDraft] = useState({
    displayName: '',
    email: '',
    classId: '',
    avatarUrl: '',
  })

  const selectedOptions = options.filter((o) => selectedClassIds.includes(o.classRow.id))
  const totalSeats = selectedOptions.reduce((sum, o) => sum + o.seats, 0)

  const plannedSessions = selectedClassIds.reduce((sum, cid) => {
    const crow = options.find((o) => o.classRow.id === cid)?.classRow
    const count = crow?.schedule?.sessionCount ??
      scheduling.scheduledSessions.filter(
        (s) => s.classId === cid && s.status !== 'cancelled' && s.status !== 'rescheduled',
      ).length ?? 0
    return sum + count
  }, 0)
  const taughtDays = scheduling.learningSessions.filter(
    (s) => selectedClassIds.includes(s.classId) && (s.status === 'completed' || s.status === 'open'),
  ).length

  const learners = useMemo(() => {
    const activeLearners = listActiveLearners(roster)
    const mapped = activeLearners.map((user) => {
      const activeEnrollmentRows = roster.enrollments.filter(
        (e) => e.learnerUserId === user.id && e.status === 'active',
      )
      const matchingOpenSession = scheduling.learningSessions.find(
        (session) =>
          session.status === 'open' &&
          activeEnrollmentRows.some((enrollment) => enrollment.classId === session.classId) &&
          (session.participantLearnerIds?.length
            ? session.participantLearnerIds.includes(user.id)
            : true),
      )
      const assignedToSelectedClasses = selectedClassIds.some((cid) =>
        activeEnrollmentRows.some((e) => e.classId === cid)
      )
      const assignedToActiveClass = classRow
        ? activeEnrollmentRows.some((e) => e.classId === classRow.id)
        : assignedToSelectedClasses
      const allSessionRows = summarizeLearnerSessions({
        ledger,
        scheduling,
        learnerUserId: user.id,
      })
      const sessionRows = allSessionRows.filter((row) => {
        const session = scheduling.learningSessions.find((s) => s.id === row.learningSessionId)
        return session && selectedClassIds.includes(session.classId)
      })
      const rfcStats = learnerRfcStats(sessionRows)
      return {
        id: user.id,
        name: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        email: user.email ?? null,
        accountStatus: user.accountStatus ?? 'active',
        classIds: activeEnrollmentRows.map((e) => e.classId),
        assignedToActiveClass,
        assignedToSelectedClasses,
        sessions: rfcStats.count,
        finalized: sessionRows.reduce((sum, row) => sum + row.total, 0),
        hasMatchingOpenSession: Boolean(matchingOpenSession),
        preferredClassId:
          matchingOpenSession?.classId ??
          (classRow && assignedToActiveClass ? classRow?.id : null) ??
          activeEnrollmentRows.find((e) => selectedClassIds.includes(e.classId))?.classId ??
          activeEnrollmentRows[0]?.classId ??
          null,
        rfcMin: rfcStats.min,
        rfcMax: rfcStats.max,
        rfcAvg: rfcStats.avg,
      }
    })

    if (selectedClassIds.length === 0) return mapped
    return mapped.filter((learner) => learner.assignedToSelectedClasses || learner.classIds.length === 0)
  }, [classRow, ledger, roster, scheduling, selectedClassIds])

  const selectedLearner =
    learners.find((learner) => learner.id === activeLearnerUserId) ?? learners[0] ?? null

  function openAddLearnerModal() {
    setAddLearnerDraft({
      displayName: '',
      email: '',
      classId: classRow?.id ?? (options[0]?.classRow.id ?? ''),
      avatarUrl: '',
    })
    setShowAddLearner(true)
  }

  async function handleCreateLearner(e: React.FormEvent) {
    e.preventDefault()
    const name = addLearnerDraft.displayName.trim()
    if (!name) return err('Display Name is required')
    const email = addLearnerDraft.email.trim() || undefined
    const classId = addLearnerDraft.classId
    const avatarUrl = addLearnerDraft.avatarUrl.trim() || undefined

    setSavingLearner(true)
    try {
      let nextRoster = roster
      let learnerName = name

      if (classId) {
        const res = createLearnerAndEnroll(roster, classId, {
          displayName: name,
          email,
          avatarUrl,
        })
        if (!res.ok) {
          return err(res.error)
        }
        nextRoster = res.state
        learnerName = res.value.learner.displayName
        setActiveLearnerUserId(res.value.learner.id)
        setActiveClassId(classId)
      } else {
        const res = addLearnerProfile(roster, {
          displayName: name,
          email,
          avatarUrl,
        })
        if (!res.ok) {
          return err(res.error)
        }
        nextRoster = res.state
        learnerName = res.value.displayName
        setActiveLearnerUserId(res.value.id)
      }

      setRoster(nextRoster)
      await syncNow({ roster: nextRoster })
      ok(`Learner ${learnerName} created`)
      setShowAddLearner(false)
      setAddLearnerDraft({ displayName: '', email: '', classId: classRow?.id ?? '', avatarUrl: '' })
    } finally {
      setSavingLearner(false)
    }
  }

  async function assignActiveClass(learnerId: string) {
    if (!classRow) return err('Create or select a class label first')
    const result = enrollLearner(roster, classRow.id, learnerId)
    if (!result.ok) return err(result.error)
    setRoster(result.state)
    await syncNow({ roster: result.state })
    ok('Class label assigned')
  }

  async function startFastSession(learnerId: string, preferredClassId: string | null) {
    if (!preferredClassId || !teacher) {
      return err('Assign this learner to a class before starting a session')
    }

    let effectiveScheduling = scheduling
    const cleanup = closeOrphanOpenSessions(roster, effectiveScheduling)
    if (cleanup.changed) {
      effectiveScheduling = cleanup.state
      setScheduling(cleanup.state)
      await syncNow({ scheduling: cleanup.state })
      ok(`Closed ${cleanup.closed.length} stale live session(s). Start again when ready.`)
    }

    const open = effectiveScheduling.learningSessions.find(
      (session) => session.classId === preferredClassId && session.status === 'open',
    )
    if (open) {
      const participants = open.participantLearnerIds?.length ? open.participantLearnerIds : []
      const includesLearner = participants.length === 0 || participants.includes(learnerId)
      if (!includesLearner) {
        const participantInfo = openSessionParticipantNames(roster, open)
        const names = participantInfo.names.join(', ')
        return err(
          `A live session is already open for ${names || 'another learner'}. Finish it before starting ${
            roster.users.find((user) => user.id === learnerId)?.displayName ?? 'this learner'
          }.`,
        )
      }
      setActiveLearnerUserId(learnerId)
      setActiveClassId(preferredClassId)
      if (
        !capture ||
        capture.learningSessionId !== open.id ||
        (participants.length > 0 &&
          (capture.learnerIds.length !== participants.length ||
            participants.some((id) => !capture.learnerIds.includes(id))))
      ) {
        setCapture(
          createCaptureSession({
            learningSessionId: open.id,
            teacherUserId: teacher.id,
            learnerIds: participants.length ? participants : [learnerId],
            maxProbeCount: open.maxProbeCount ?? metricSettings.defaultMaxProbeCount,
          }),
        )
      }
      navigate('/teacher/observe')
      return
    }

    setStartingLearnerId(learnerId)
    try {
      const maxProbeCount = metricSettings.defaultMaxProbeCount
      const started = startLearningSession(effectiveScheduling, {
        classId: preferredClassId,
        maxProbeCount,
        ownerUserId: teacher.id,
        sessionKind: 'regular',
        participantLearnerIds: [learnerId],
        sessionNumber: nextLearnerSessionNumber({
          ledger,
          scheduling: effectiveScheduling,
          learnerUserId: learnerId,
        }),
      })
      if (!started.ok) return err(started.error)

      const nextCapture = createCaptureSession({
        learningSessionId: started.value.id,
        teacherUserId: teacher.id,
        learnerIds: [learnerId],
        maxProbeCount,
      })
      setActiveLearnerUserId(learnerId)
      setActiveClassId(preferredClassId)
      setScheduling(started.state)
      setCapture(nextCapture)

      const { ensureLearningSessionOnServer } = await import('../../lib/live-assessment')
      await Promise.all([
        ensureLearningSessionOnServer(started.value),
        syncNow({ scheduling: started.state }),
      ])
      navigate('/teacher/observe')
    } finally {
      setStartingLearnerId(null)
    }
  }

  if (!teacher) {
    return (
      <>
        <PageHeader
          icon={Users}
          kicker="Teacher"
          title="Learners"
          subtitle="Create learners first. Class labels can be assigned later."
        />
        <EmptyState
          icon={School}
          title="Teacher profile missing"
          description="Ask Admin to create your Teacher account and mark it active."
          action={
            <Link to="/teacher/classes" className="btn primary">
              <School className="h-4 w-4" aria-hidden />
              <span>My classes</span>
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon={Home}
        kicker={course?.code ?? 'Learners'}
        title="Learner dashboard"
        subtitle={`${learners.length} learners · ${
          classRow
            ? `${course?.name ?? classRow.name} · ${seats} in class`
            : mode === 'all'
            ? `All classes · ${totalSeats} total learners`
            : selectedClassIds.length > 0
            ? `${selectedClassIds.length} classes · ${totalSeats} total learners`
            : 'no class label selected yet'
        } · ${taughtDays}/${plannedSessions || '—'} sessions${
          hasMultiple ? ` · ${options.length} classes` : ''
        }`}
        actions={
          <div className="page-actions">
            <button
              type="button"
              className="primary"
              onClick={openAddLearnerModal}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              <span>Add learner</span>
            </button>
            <button
              type="button"
              className={viewMode === 'grid' ? 'active' : 'ghost'}
              onClick={() => setViewMode('grid')}
              title="Grid card view"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              <span>Grid</span>
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'active' : 'ghost'}
              onClick={() => setViewMode('list')}
              title="Compact list view"
            >
              <List className="h-4 w-4" aria-hidden />
              <span>List</span>
            </button>
          </div>
        }
      />
      <Flash message={message} error={error} />

      {showAddLearner ? (
        <Panel
          icon={UserPlus}
          title="New learner"
          description="Creates a staff-managed learner profile with customizable avatar and optional class enrollment."
        >
          <form className="accounts-add-form" onSubmit={(e) => void handleCreateLearner(e)}>
            {/* Sleek Avatar Uploader */}
            <div className="avatar-uploader-section p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 mb-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Learner Avatar
              </span>
              <div className="flex flex-wrap items-center gap-5">
                {/* Circular Avatar Preview */}
                <div className="relative flex-shrink-0">
                  <div className="h-20 w-20 rounded-full border-2 border-indigo-500/30 shadow-md overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center">
                    {addLearnerDraft.avatarUrl ? (
                      <img
                        src={addLearnerDraft.avatarUrl}
                        alt="Avatar preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <UserPlus className="h-7 w-7 opacity-60" />
                        <span className="text-[10px] mt-0.5 font-medium">No photo</span>
                      </div>
                    )}
                  </div>
                  {addLearnerDraft.avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => setAddLearnerDraft((d) => ({ ...d, avatarUrl: '' }))}
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-rose-500 text-white shadow hover:bg-rose-600 transition-colors"
                      title="Clear avatar"
                      aria-label="Clear avatar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Upload & Preset Palette */}
                <div className="flex-1 min-w-[220px] space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-sm transition-all text-slate-700 dark:text-slate-200">
                      <Upload className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Upload file</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setAddLearnerDraft((d) => ({ ...d, avatarUrl: reader.result as string }))
                            }
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>

                    {addLearnerDraft.avatarUrl ? (
                      <button
                        type="button"
                        onClick={() => setAddLearnerDraft((d) => ({ ...d, avatarUrl: '' }))}
                        className="px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      >
                        Clear avatar
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
                      Or pick an avatar preset:
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {PRESET_AVATARS.map((preset) => {
                        const isSelected = addLearnerDraft.avatarUrl === preset.url
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              setAddLearnerDraft((d) => ({ ...d, avatarUrl: preset.url }))
                            }
                            className={`h-8 w-8 rounded-full overflow-hidden transition-transform hover:scale-110 ${
                              isSelected
                                ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-105'
                                : 'opacity-85 hover:opacity-100'
                            }`}
                            title={preset.label}
                          >
                            <img src={preset.url} alt={preset.label} className="h-full w-full object-cover" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <label>
              Display Name <span className="text-red-500">*</span>
              <input
                type="text"
                value={addLearnerDraft.displayName}
                onChange={(e) => setAddLearnerDraft((d) => ({ ...d, displayName: e.target.value }))}
                required
                placeholder="Learner name (e.g. Alex Nguyen)"
                autoFocus
              />
            </label>
            <label>
              Email (optional)
              <input
                type="email"
                value={addLearnerDraft.email}
                onChange={(e) => setAddLearnerDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="learner@school.edu"
              />
            </label>
            <label>
              Class enrollment
              <select
                value={addLearnerDraft.classId}
                onChange={(e) => setAddLearnerDraft((d) => ({ ...d, classId: e.target.value }))}
              >
                <option value="">Do not enroll in a class yet</option>
                {options.map((opt) => (
                  <option key={opt.classRow.id} value={opt.classRow.id}>
                    {opt.classRow.name} ({opt.course ? `${opt.course.code} - ${opt.course.name}` : 'No course'})
                  </option>
                ))}
              </select>
            </label>
            <div className="btn-row">
              <button type="submit" className="primary" disabled={savingLearner}>
                {savingLearner ? 'Saving…' : 'Save Learner'}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={savingLearner}
                onClick={() => {
                  setShowAddLearner(false)
                  setAddLearnerDraft({ displayName: '', email: '', classId: classRow?.id ?? '', avatarUrl: '' })
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel
        icon={Users}
        title="Learners"
        description="Manage learner list, open profile, track RFC progress, or start a session for one learner."
      >
        {learners.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No learners yet"
            description="Add the first learner above."
          />
        ) : viewMode === 'grid' ? (
          <div className="teacher-learner-grid">
            {learners.map((learner) => (
              <LearnerCard
                key={learner.id}
                learner={learner}
                selected={selectedLearner?.id === learner.id}
                openSession={learner.hasMatchingOpenSession}
                starting={startingLearnerId === learner.id}
                activeClassName={classRow?.name ?? null}
                canAssignActiveClass={Boolean(classRow) && !learner.assignedToActiveClass}
                onAssignActiveClass={() => assignActiveClass(learner.id)}
                onSelect={() => {
                  setActiveLearnerUserId(learner.id)
                  if (learner.preferredClassId) setActiveClassId(learner.preferredClassId)
                }}
                onStart={() => void startFastSession(learner.id, learner.preferredClassId)}
              />
            ))}
          </div>
        ) : (
          <div className="table-wrap learner-list-table">
            <table aria-label="Learner list">
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  <th scope="col" title="Minimum RFC across sessions">
                    RFC min
                  </th>
                  <th scope="col" title="Maximum RFC across sessions">
                    RFC max
                  </th>
                  <th scope="col" title="Average RFC across sessions">
                    RFC avg
                  </th>
                  <th scope="col">Sessions</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((learner) => (
                  <tr
                    key={learner.id}
                    className={selectedLearner?.id === learner.id ? 'bg-slate-100/80' : ''}
                  >
                    <td>
                      <button
                        type="button"
                        className="learner-inline-button"
                        onClick={() => setActiveLearnerUserId(learner.id)}
                      >
                        <UserAvatar name={learner.name} avatarUrl={learner.avatarUrl} size="sm" />
                        <span>
                          <strong>{learner.name}</strong>
                          <small>{learner.email ?? 'No email'}</small>
                        </span>
                      </button>
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {formatPercent(learner.rfcMin)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {formatPercent(learner.rfcMax)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {formatPercent(learner.rfcAvg)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">{learner.sessions}</td>
                    <td>
                      <div className="btn-row my-0">
                        <Link
                          to={`/teacher/learner/${encodeURIComponent(learner.id)}`}
                          className="btn ghost"
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                          Profile
                        </Link>
                        {classRow && !learner.assignedToActiveClass ? (
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => assignActiveClass(learner.id)}
                          >
                            Assign {classRow.name}
                          </button>
                        ) : null}
                        {learner.hasMatchingOpenSession ? (
                          <Link
                            to="/teacher/observe"
                            className="btn primary"
                            onClick={() => {
                              setActiveLearnerUserId(learner.id)
                              if (learner.preferredClassId) setActiveClassId(learner.preferredClassId)
                            }}
                          >
                            <Play className="h-4 w-4" aria-hidden />
                            Open live
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="primary"
                            onClick={() => void startFastSession(learner.id, learner.preferredClassId)}
                            disabled={startingLearnerId === learner.id || !learner.preferredClassId}
                          >
                            <Play className="h-4 w-4" aria-hidden />
                            {startingLearnerId === learner.id ? 'Starting…' : 'Start now'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {capture?.sessionStatus === 'open' ? (
        <p className="meta">
          Capture board is open —{' '}
          <Link to="/teacher/observe" className="underline font-semibold">
            continue Observe
          </Link>
          .
        </p>
      ) : null}
    </>
  )
}

function LearnerCard({
  learner,
  selected,
  openSession,
  starting,
  activeClassName,
  canAssignActiveClass,
  onAssignActiveClass,
  onSelect,
  onStart,
}: {
  learner: {
    id: string
    name: string
    avatarUrl: string | null
    email: string | null
    sessions: number
    finalized: number
    rfcMin: number | null
    rfcMax: number | null
    rfcAvg: number | null
    classIds: string[]
    hasMatchingOpenSession: boolean
    preferredClassId: string | null
  }
  selected: boolean
  openSession: boolean
  starting: boolean
  activeClassName: string | null
  canAssignActiveClass: boolean
  onAssignActiveClass: () => void
  onSelect: () => void
  onStart: () => void
}) {
  return (
    <article className={`teacher-learner-card${selected ? ' is-selected' : ''}`}>
      <button type="button" className="teacher-learner-card-main" onClick={onSelect}>
        <UserAvatar name={learner.name} avatarUrl={learner.avatarUrl} size="lg" />
        <span>
          <strong>{learner.name}</strong>
          <small>{learner.email ?? 'No email'}</small>
        </span>
      </button>
      <div className="teacher-learner-mini-stats">
        <span title="Minimum RFC across sessions">
          <strong>{formatPercent(learner.rfcMin)}</strong>
          <small>Min</small>
        </span>
        <span title="Maximum RFC across sessions">
          <strong>{formatPercent(learner.rfcMax)}</strong>
          <small>Max</small>
        </span>
        <span title="Average RFC across sessions">
          <strong>{formatPercent(learner.rfcAvg)}</strong>
          <small>Avg</small>
        </span>
      </div>
      <p className="meta my-0">
        {learner.sessions} session(s) · {learner.finalized} finalized observations ·{' '}
        {learner.classIds.length ? `${learner.classIds.length} class label(s)` : 'No class label'}
      </p>
      <div className="btn-row teacher-learner-card-actions">
        {canAssignActiveClass && activeClassName ? (
          <button type="button" className="ghost" onClick={onAssignActiveClass}>
            Assign {activeClassName}
          </button>
        ) : null}
        <Link to={`/teacher/learner/${encodeURIComponent(learner.id)}`} className="btn ghost">
          <Eye className="h-4 w-4" aria-hidden />
          Profile
        </Link>
        {openSession ? (
          <Link to="/teacher/observe" className="btn primary" onClick={onSelect}>
            <Play className="h-4 w-4" aria-hidden />
            Open live
          </Link>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={onStart}
            disabled={starting || !learner.preferredClassId}
          >
            <Play className="h-4 w-4" aria-hidden />
            {starting ? 'Starting…' : 'Start now'}
          </button>
        )}
      </div>
    </article>
  )
}
