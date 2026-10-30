import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  GraduationCap,
  Home,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  Play,
  School,
  Sparkles,
  User,
  UserPlus,
  Users,
  Trash2,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { useStaffSession } from '../../auth/useStaffSession'
import {
  addLearnerProfile,
  createLearnerAndEnroll,
  endEnrollment,
  enrollLearner,
  listActiveLearners,
  setAccountStatus,
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
import { createCaptureSession, markSessionCompleted } from '../../modules/assessment/session-capture'
import {
  closeOrphanOpenSessions,
  openSessionParticipantNames,
} from '../../modules/scheduling/orphan-sessions'
import { completeLearningSession, startLearningSession } from '../../modules/scheduling/session-lifecycle'
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
    appendFinalizedFromCapture,
    syncNow,
  } = useAppState()
  const { options, classRow, course, teacher, seats, hasMultiple, selectedClassIds, mode } = useTeacherClassContext()
  const staffSession = useStaffSession()
  const navigate = useNavigate()
  const { message, error, ok, err } = useFlash()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [startingLearnerId, setStartingLearnerId] = useState<string | null>(null)
  const [showAddLearner, setShowAddLearner] = useState(false)
  const [savingLearner, setSavingLearner] = useState(false)
  const [rolloverPrompt, setRolloverPrompt] = useState<{
    openSession: import('../../modules/scheduling/types').LearningSession
    newLearnerId: string
    preferredClassId: string
    openParticipantNames: string
    summary: { total: number; done: number } | null
  } | null>(null)
  const [rolloverLoading, setRolloverLoading] = useState(false)
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

    const teacherOperableClassIds = new Set(options.map((o) => o.classRow.id))
    const isAdmin = staffSession.canAccess('admin')

    return mapped.filter((learner) => {
      if (isAdmin) {
        if (selectedClassIds.length === 0) return true
        return learner.assignedToSelectedClasses || learner.classIds.length === 0
      }
      // For Teacher: strictly scope to learners enrolled in teacher's operable classes
      const inTeacherClass = learner.classIds.some((cid) => teacherOperableClassIds.has(cid))
      if (selectedClassIds.length > 0) {
        return learner.assignedToSelectedClasses
      }
      return inTeacherClass
    })
  }, [classRow, ledger, options, roster, scheduling, selectedClassIds, staffSession])

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
    if (!classId && !staffSession.canAccess('admin')) {
      return err('Please select a class to enroll this learner.')
    }
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

  async function handleArchiveLearner(learnerId: string, learnerName: string) {
    if (
      !window.confirm(
        `Are you sure you want to remove ${learnerName}? The learner will be archived and removed from active class lists. All past session and assessment history is safely preserved.`,
      )
    ) {
      return
    }
    let nextRoster = roster
    const activeEnrollments = nextRoster.enrollments.filter(
      (e) => e.learnerUserId === learnerId && e.status === 'active',
    )
    for (const enr of activeEnrollments) {
      const endRes = endEnrollment(nextRoster, enr.id)
      if (endRes.ok) nextRoster = endRes.state
    }
    const statusRes = setAccountStatus(nextRoster, learnerId, 'inactive')
    if (!statusRes.ok) {
      return err(statusRes.error)
    }
    nextRoster = statusRes.state
    setRoster(nextRoster)
    await syncNow({ roster: nextRoster })
    ok(`Learner ${learnerName} has been archived.`)
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
        const isCurrentCapture = capture && capture.learningSessionId === open.id
        const summaryData = isCurrentCapture
          ? {
              total: capture.questions.length,
              done: capture.attempts.filter(
                (a) => a.snapshot.status === 'finalized' || a.snapshot.status === 'corrected',
              ).length,
            }
          : null
        setRolloverPrompt({
          openSession: open,
          newLearnerId: learnerId,
          preferredClassId,
          openParticipantNames: names || 'another learner',
          summary: summaryData,
        })
        return
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

  async function confirmRolloverAndStart() {
    if (!rolloverPrompt || !teacher) return
    const { openSession, newLearnerId, preferredClassId } = rolloverPrompt
    setRolloverLoading(true)
    try {
      const participants = openSession.participantLearnerIds?.length
        ? openSession.participantLearnerIds
        : []
      const done = completeLearningSession(scheduling, openSession.id, participants)
      if (!done.ok) {
        err(done.error)
        return
      }

      if (capture && capture.learningSessionId === openSession.id) {
        const completedCapture = markSessionCompleted(capture)
        const { syncCaptureSessionToServer } = await import('../../lib/live-assessment')
        const syncRes = await syncCaptureSessionToServer(completedCapture)
        if (!syncRes.ok) {
          err(`Không thể lưu kết quả ca học trước lên server: ${syncRes.error}`)
          return
        }
        appendFinalizedFromCapture(completedCapture)
      }
      const maxProbeCount = metricSettings.defaultMaxProbeCount
      const nextSessionNum = nextLearnerSessionNumber({
        ledger,
        scheduling: done.state,
        learnerUserId: newLearnerId,
      })
      const started = startLearningSession(done.state, {
        classId: preferredClassId,
        maxProbeCount,
        ownerUserId: teacher.id,
        sessionKind: 'regular',
        participantLearnerIds: [newLearnerId],
        sessionNumber: nextSessionNum,
      })
      if (!started.ok) {
        err(started.error)
        return
      }

      const nextCapture = createCaptureSession({
        learningSessionId: started.value.id,
        teacherUserId: teacher.id,
        learnerIds: [newLearnerId],
        maxProbeCount,
      })

      setActiveLearnerUserId(newLearnerId)
      setActiveClassId(preferredClassId)
      setScheduling(started.state)
      setCapture(nextCapture)

      const { ensureLearningSessionOnServer } = await import('../../lib/live-assessment')
      await Promise.all([
        ensureLearningSessionOnServer(started.value),
        syncNow({ scheduling: started.state }),
      ])

      const newLearnerName = roster.users.find((u) => u.id === newLearnerId)?.displayName ?? 'học viên'
      ok(`Completed previous session & started new session for ${newLearnerName}`)
      setRolloverPrompt(null)
      navigate('/teacher/observe')
    } catch (e) {
      err(e instanceof Error ? e.message : 'Failed to complete rollover')
    } finally {
      setRolloverLoading(false)
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
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden mb-8 transition-all">
          {/* Card Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 via-slate-50/30 to-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">New learner</h2>
                <p className="text-xs text-slate-500">
                  Creates a staff-managed learner profile with customizable avatar and optional class enrollment.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddLearner(false)
                setAddLearnerDraft({ displayName: '', email: '', classId: classRow?.id ?? '', avatarUrl: '' })
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Close"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={(e) => void handleCreateLearner(e)} className="p-6 sm:p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Avatar Studio (5 cols) */}
              <div className="lg:col-span-5 flex flex-col items-center p-6 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Learner Avatar</span>
                </span>

                {/* Big Avatar Frame */}
                <div className="relative group mb-4">
                  <div className="h-28 w-28 rounded-full ring-4 ring-white shadow-md overflow-hidden bg-white border border-slate-200 flex items-center justify-center transition-transform group-hover:scale-[1.02]">
                    {addLearnerDraft.avatarUrl ? (
                      <img
                        src={addLearnerDraft.avatarUrl}
                        alt="Avatar preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300">
                        <UserPlus className="h-10 w-10 opacity-70" />
                        <span className="text-[10px] font-medium text-slate-400 mt-1">No photo</span>
                      </div>
                    )}
                  </div>

                  {addLearnerDraft.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAddLearnerDraft((d) => ({ ...d, avatarUrl: '' }))}
                      className="absolute top-0 right-0 p-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-md transition-colors"
                      title="Clear avatar"
                      aria-label="Clear avatar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Upload Action */}
                <div className="flex items-center gap-2 mb-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs text-xs font-semibold text-slate-700 hover:text-indigo-600 cursor-pointer transition-all">
                    <Camera className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Upload photo</span>
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
                            const img = new Image()
                            img.onload = () => {
                              const maxDim = 128
                              let width = img.width
                              let height = img.height
                              if (width > height) {
                                if (width > maxDim) {
                                  height = Math.round((height * maxDim) / width)
                                  width = maxDim
                                }
                              } else {
                                if (height > maxDim) {
                                  width = Math.round((width * maxDim) / height)
                                  height = maxDim
                                }
                              }
                              const canvas = document.createElement('canvas')
                              canvas.width = width
                              canvas.height = height
                              const ctx = canvas.getContext('2d')
                              ctx?.drawImage(img, 0, 0, width, height)
                              const compressedUrl = canvas.toDataURL('image/jpeg', 0.85)
                              setAddLearnerDraft((d) => ({ ...d, avatarUrl: compressedUrl }))
                            }
                            img.src = reader.result
                          }
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                  </label>
                  {addLearnerDraft.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAddLearnerDraft((d) => ({ ...d, avatarUrl: '' }))}
                      className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      Clear avatar
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mb-4">PNG, JPG, or WebP (max 5MB)</p>

                {/* Preset Palette */}
                <div className="w-full pt-4 border-t border-slate-200/80">
                  <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                    Or choose an illustrated preset
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    {PRESET_AVATARS.map((preset) => {
                      const isSelected = addLearnerDraft.avatarUrl === preset.url
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setAddLearnerDraft((d) => ({ ...d, avatarUrl: preset.url }))}
                          className={`relative p-0.5 rounded-full transition-all hover:scale-110 focus:outline-none ${
                            isSelected
                              ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105 shadow-sm'
                              : 'opacity-80 hover:opacity-100'
                          }`}
                          title={preset.label}
                        >
                          <img src={preset.url} alt={preset.label} className="h-8 w-8 rounded-full object-cover shadow-2xs" />
                          {isSelected && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] shadow">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Inputs Form (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                {/* Display Name Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="learner-name">
                    Display Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      id="learner-name"
                      aria-label="Display Name"
                      type="text"
                      value={addLearnerDraft.displayName}
                      onChange={(e) => setAddLearnerDraft((d) => ({ ...d, displayName: e.target.value }))}
                      required
                      placeholder="e.g. Alex Nguyen"
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    The student's full name as displayed on test rosters and progress telemetry.
                  </p>
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="learner-email">
                    Email (optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="learner-email"
                      aria-label="Email (optional)"
                      type="email"
                      value={addLearnerDraft.email}
                      onChange={(e) => setAddLearnerDraft((d) => ({ ...d, email: e.target.value }))}
                      placeholder="alex.nguyen@chunks.edu"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Optional contact email used for notifications and reporting reconciliation.
                  </p>
                </div>

                {/* Class Enrollment Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="learner-class">
                    Class enrollment
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <select
                      id="learner-class"
                      aria-label="Class enrollment"
                      value={addLearnerDraft.classId}
                      onChange={(e) => setAddLearnerDraft((d) => ({ ...d, classId: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
                    >
                      {staffSession.canAccess('admin') ? (
                        <option value="">Do not enroll in a class yet (Unassigned Learner)</option>
                      ) : (
                        <option value="">Select a class...</option>
                      )}
                      {options.map((opt) => (
                        <option key={opt.classRow.id} value={opt.classRow.id}>
                          {opt.classRow.name} {opt.course ? `· ${opt.course.code} (${opt.course.name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Directly seat this learner in an active class schedule, or leave unassigned to seat later.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Footer Actions */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={savingLearner}
                onClick={() => {
                  setShowAddLearner(false)
                  setAddLearnerDraft({ displayName: '', email: '', classId: classRow?.id ?? '', avatarUrl: '' })
                }}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingLearner || !addLearnerDraft.displayName.trim() || (!addLearnerDraft.classId && !staffSession.canAccess('admin'))}
                className="px-6 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 transition-all inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingLearner ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Save Learner</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
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
                onArchive={() => void handleArchiveLearner(learner.id, learner.name)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {learners.map((learner) => (
              <div
                key={learner.id}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-3.5 rounded-2xl border bg-white transition-all hover:shadow-xs hover:border-slate-300 ${
                  selectedLearner?.id === learner.id
                    ? 'border-slate-300 ring-1 ring-slate-400/30 bg-slate-50/50'
                    : 'border-slate-200/80'
                }`}
              >
                {/* Left: Avatar + Name + Email */}
                <div
                  role="button"
                  tabIndex={0}
                  className="flex items-center justify-start text-left gap-3 min-w-0 flex-1 bg-transparent border-0 p-0 cursor-pointer"
                  onClick={() => {
                    setActiveLearnerUserId(learner.id)
                    if (learner.preferredClassId) setActiveClassId(learner.preferredClassId)
                  }}
                >
                  <div className="relative shrink-0">
                    <UserAvatar name={learner.name} avatarUrl={learner.avatarUrl} size="md" />
                    {learner.hasMatchingOpenSession && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="flex items-center justify-start gap-2">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-red-700 transition-colors truncate">
                        {learner.name}
                      </span>
                      {learner.hasMatchingOpenSession && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">
                          Live
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 truncate block mt-0.5 text-left">
                      {learner.email ?? 'No email'} · {learner.sessions} session(s)
                    </span>
                  </div>
                </div>

                {/* Center: Minimal Stats Badge Row */}
                <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-mono">
                    <span className="text-slate-400 text-[10px] font-sans uppercase font-bold">RFC</span>
                    <span className="text-slate-600 font-semibold" title="Min RFC">{formatPercent(learner.rfcMin)}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-red-700 font-bold" title="Avg RFC">{formatPercent(learner.rfcAvg)}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-600 font-semibold" title="Max RFC">{formatPercent(learner.rfcMax)}</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {classRow && !learner.assignedToActiveClass ? (
                    <button
                      type="button"
                      className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                      onClick={() => assignActiveClass(learner.id)}
                    >
                      Assign {classRow.name}
                    </button>
                  ) : null}
                  <Link
                    to={`/teacher/learner/${encodeURIComponent(learner.id)}`}
                    className="inline-flex items-center gap-1 py-1.5 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-red-700 text-xs font-semibold transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                    <span>Profile</span>
                  </Link>
                  {learner.hasMatchingOpenSession ? (
                    <Link
                      to="/teacher/observe"
                      className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-xs transition-colors"
                      onClick={() => {
                        setActiveLearnerUserId(learner.id)
                        if (learner.preferredClassId) setActiveClassId(learner.preferredClassId)
                      }}
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                      <span>Open live</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => void startFastSession(learner.id, learner.preferredClassId)}
                      disabled={startingLearnerId === learner.id || !learner.preferredClassId}
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                      <span>{startingLearnerId === learner.id ? 'Starting…' : 'Start now'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    onClick={() => void handleArchiveLearner(learner.id, learner.name)}
                    title={`Archive ${learner.name}`}
                    aria-label={`Archive ${learner.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {rolloverPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-amber-600">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <h3 className="font-bold text-base text-slate-900">Ca học trước đang mở</h3>
              </div>
              <button
                type="button"
                onClick={() => setRolloverPrompt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2">
              <p className="text-slate-700">
                Lớp <strong className="text-slate-900">{classRow?.name ?? 'này'}</strong> hiện có ca học <strong>Day {rolloverPrompt.openSession.sessionNumber ?? '—'}</strong> của học viên <strong className="text-slate-900">{rolloverPrompt.openParticipantNames}</strong> đang hoạt động.
              </p>
              {rolloverPrompt.summary ? (
                <p className="text-slate-500 font-mono text-[11px]">
                  Số câu đã tạo: {rolloverPrompt.summary.total} · Đã chấm xong: {rolloverPrompt.summary.done}
                </p>
              ) : null}
              <p className="text-red-700 font-medium">
                Bạn có muốn hoàn tất ca học trước và bắt đầu ca học mới ngay cho <strong className="text-slate-950 font-bold">{roster.users.find((u) => u.id === rolloverPrompt.newLearnerId)?.displayName ?? 'học viên mới'}</strong> không?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={rolloverLoading}
                onClick={() => setRolloverPrompt(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={rolloverLoading}
                onClick={() => void confirmRolloverAndStart()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-700 hover:bg-red-800 text-white shadow-xs inline-flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {rolloverLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang hoàn tất &amp; mở ca mới…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Hoàn thành &amp; Bắt đầu mới</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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
  onArchive,
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
  onArchive: () => void
}) {
  return (
    <article
      className={`group relative flex flex-col justify-between gap-4 rounded-2xl border p-4 bg-white shadow-2xs transition-all hover:shadow-xs hover:border-slate-300 ${
        selected
          ? 'border-slate-300 ring-1 ring-slate-400/30'
          : 'border-slate-200/80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          role="button"
          tabIndex={0}
          className="flex items-center justify-start text-left gap-3 min-w-0 flex-1 bg-transparent border-0 p-0 cursor-pointer"
          onClick={onSelect}
        >
          <div className="relative shrink-0">
            <UserAvatar name={learner.name} avatarUrl={learner.avatarUrl} size="md" />
            {openSession && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-900 truncate leading-snug group-hover:text-red-700 transition-colors">
              {learner.name}
            </h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {learner.email ?? 'No email'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-70 hover:opacity-100"
          title={`Remove/archive ${learner.name}`}
          aria-label={`Remove ${learner.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Minimal Stats Row */}
      <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-50/80 border border-slate-100 text-center">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Min RFC</span>
          <span className="font-mono text-xs font-bold text-slate-700">{formatPercent(learner.rfcMin)}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg RFC</span>
          <span className="font-mono text-xs font-bold text-red-700">{formatPercent(learner.rfcAvg)}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Sessions</span>
          <span className="font-mono text-xs font-bold text-slate-700">{learner.sessions}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        {canAssignActiveClass && activeClassName ? (
          <button
            type="button"
            className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium truncate"
            onClick={onAssignActiveClass}
          >
            Assign {activeClassName}
          </button>
        ) : null}
        <Link
          to={`/teacher/learner/${encodeURIComponent(learner.id)}`}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-red-700 text-xs font-semibold transition-colors"
        >
          <Eye className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <span>Profile</span>
        </Link>
        {openSession ? (
          <Link
            to="/teacher/observe"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-xs transition-colors"
            onClick={onSelect}
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            <span>Open live</span>
          </Link>
        ) : (
          <button
            type="button"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onStart}
            disabled={starting || !learner.preferredClassId}
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            <span>{starting ? 'Starting…' : 'Start now'}</span>
          </button>
        )}
      </div>
    </article>
  )
}
