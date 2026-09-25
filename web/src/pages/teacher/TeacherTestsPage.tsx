import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  ClipboardCheck,
  ExternalLink,
  Play,
  RotateCcw,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { listActiveLearners } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'
import {
  detectPackageKind,
  listTestItems,
  listTestPackages,
  listTestPackageVersions,
  listTestSections,
  type PackageKind,
} from '../../lib/test-packages'
import {
  createStandaloneAssignment,
  deleteStandaloneAssignment,
  getStandaloneAssignmentProgress,
  listStandaloneAssignments,
  listStandaloneRuns,
  type StandaloneAssignmentProgress,
  type StandaloneTestAssignmentRow,
} from '../../lib/standalone-tests'

export interface SelectablePackageVersion {
  id: string
  packageId: string
  code: string
  label: string
  title: string
  versionLabel: string
  kind: PackageKind
  testType: 'green' | 'red'
  questionCount: number
}

async function packageQuestionCount(packageVersionId: string): Promise<number> {
  const sections = await listTestSections(packageVersionId)
  if (!sections.ok) return 0
  let total = 0
  for (const section of sections.data) {
    const items = await listTestItems(section.id)
    if (items.ok) total += items.data.length
  }
  return total
}

export function TeacherTestsPage() {
  const { roster } = useAppState()
  const navigate = useNavigate()
  const learners = listActiveLearners(roster)
  const [learnerId, setLearnerId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [packageTypeTab, setPackageTypeTab] = useState<'all' | 'green' | 'red'>('all')
  const [versions, setVersions] = useState<SelectablePackageVersion[]>([])
  const [message, setMessage] = useState('')
  const [assignments, setAssignments] = useState<StandaloneTestAssignmentRow[]>([])
  const [busyAssignmentId, setBusyAssignmentId] = useState<string | null>(null)
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set())
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [assignmentLearnerSearch, setAssignmentLearnerSearch] = useState('')
  const [assignmentPackageFilter, setAssignmentPackageFilter] = useState('all')
  const [assignmentProgress, setAssignmentProgress] = useState<Record<string, StandaloneAssignmentProgress>>({})

  const loadAssignments = useCallback(async () => {
    const result = await listStandaloneAssignments()
    if (result.ok) setAssignments(result.data)
    else setMessage(result.error)
  }, [])

  useEffect(() => {
    void (async () => {
      const packages = await listTestPackages()
      if (!packages.ok) return
      const next: SelectablePackageVersion[] = []
      for (const pkg of packages.data) {
        // Filter out packages toggled OFF by Admin
        if (pkg.sourceMetadata?.is_active === false) continue

        const result = await listTestPackageVersions(pkg.id)
        if (result.ok) {
          const kind = detectPackageKind(pkg)
          // Strip · LIVE and trailing suffixes (e.g. " · LIVE", " · LIVE-56V", " · LIVE-31V")
          const rawTitle = pkg.title.replace(/\s*·\s*LIVE.*$/i, '').trim()
          const isMini = kind === 'mini' || rawTitle.toLowerCase().includes('[mini]') || pkg.slug.startsWith('mini-')
          
          // Clean base test code (e.g. G1-56V-0826, R1-56V-0826)
          const baseCode = rawTitle.replace(/^\[Mini\]\s*/i, '').replace(/^mini-/i, '').trim()
          
          // Display name:
          // Standard: "G1-56V-0826"
          // Mini: "G1-56V-0826 [Mini]"
          const cleanLabel = isMini ? `${baseCode} [Mini]` : baseCode

          const isGreen =
            baseCode.toLowerCase().startsWith('g') ||
            baseCode.toLowerCase().includes('green')
          const testType: 'green' | 'red' = isGreen ? 'green' : 'red'

          for (const version of result.data.filter((v) => v.status === 'published')) {
            const sections = await listTestSections(version.id)
            if (!sections.ok || sections.data.length === 0) continue
            next.push({
              id: version.id,
              packageId: pkg.id,
              code: baseCode,
              label: cleanLabel,
              title: cleanLabel,
              versionLabel: version.versionLabel,
              kind: isMini ? 'mini' : 'standard',
              testType,
              questionCount: isMini ? 21 : 49,
            })
          }
        }
      }
      next.sort((a, b) => {
        if (a.testType !== b.testType) return a.testType === 'green' ? -1 : 1
        if (a.code !== b.code) return a.code.localeCompare(b.code)
        if (a.kind !== b.kind) return a.kind === 'standard' ? -1 : 1
        return 0
      })
      setVersions(next)
      setVersionId(next[0]?.id ?? '')
    })()
  }, [])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  useEffect(() => {
    setSelectedAssignmentIds((current) => {
      const validIds = new Set(assignments.map((assignment) => assignment.id))
      return new Set(Array.from(current).filter((id) => validIds.has(id)))
    })
  }, [assignments])

  useEffect(() => {
    let cancelled = false
    const activeAssignments = assignments.filter((assignment) => assignment.status === 'active')
    if (activeAssignments.length === 0) {
      setAssignmentProgress({})
      return
    }

    void (async () => {
      const packageTotals = new Map<string, number>()
      const next: Record<string, StandaloneAssignmentProgress> = {}
      for (const assignment of activeAssignments) {
        let totalQuestions = packageTotals.get(assignment.packageVersionId)
        if (totalQuestions == null) {
          totalQuestions = await packageQuestionCount(assignment.packageVersionId)
          packageTotals.set(assignment.packageVersionId, totalQuestions)
        }
        const progress = await getStandaloneAssignmentProgress(assignment.id)
        next[assignment.id] = {
          assignmentId: assignment.id,
          completedQuestions: progress.ok ? progress.data.completedQuestions : 0,
          totalQuestions: Math.max(progress.ok ? progress.data.totalQuestions : 0, totalQuestions),
        }
        if (!cancelled) {
          setAssignmentProgress((current) => ({ ...current, [assignment.id]: next[assignment.id]! }))
        }
      }
      if (!cancelled) setAssignmentProgress(next)
    })()

    return () => {
      cancelled = true
    }
  }, [assignments])

  const filteredAssignments = assignments.filter((assignment) => {
    if (assignmentStatusFilter !== 'all' && assignment.status !== assignmentStatusFilter) return false
    if (assignmentPackageFilter === 'standard') {
      const v = versions.find((ver) => ver.id === assignment.packageVersionId)
      if (v?.kind !== 'standard') return false
    } else if (assignmentPackageFilter === 'mini') {
      const v = versions.find((ver) => ver.id === assignment.packageVersionId)
      if (v?.kind !== 'mini') return false
    } else if (assignmentPackageFilter !== 'all' && assignment.packageVersionId !== assignmentPackageFilter) {
      return false
    }
    const q = assignmentLearnerSearch.trim().toLowerCase()
    if (!q) return true
    const learnerName = learners.find((learner) => learner.id === assignment.learnerUserId)?.displayName ?? ''
    const learnerEmail = learners.find((learner) => learner.id === assignment.learnerUserId)?.email ?? ''
    return (
      learnerName.toLowerCase().includes(q) ||
      learnerEmail.toLowerCase().includes(q) ||
      assignment.learnerUserId.toLowerCase().includes(q)
    )
  })

  async function start() {
    if (!learnerId || !versionId) {
      setMessage('Select one Learner and one published Package Version.')
      return
    }
    const assignment = await createStandaloneAssignment(learnerId, versionId)
    if (!assignment.ok) {
      setMessage(assignment.error)
      return
    }
    const sections = await listTestSections(versionId)
    if (!sections.ok || !sections.data[0]) {
      setMessage(sections.ok ? 'Package has no sessions.' : sections.error)
      return
    }
    navigate(`/teacher/tests/${assignment.data}/sections/${sections.data[0].id}/setup`)
  }

  async function openOrResumeAssignment(assignment: StandaloneTestAssignmentRow) {
    setBusyAssignmentId(assignment.id)
    setMessage('')
    const runs = await listStandaloneRuns(assignment.id)
    if (!runs.ok) {
      setBusyAssignmentId(null)
      setMessage(runs.error)
      return
    }
    const resumable = runs.data.find((run) => ['in_progress', 'ready', 'draft'].includes(run.status))
    const latestRun = [...runs.data].sort((a, b) => b.sessionNumber - a.sessionNumber || b.attemptNumber - a.attemptNumber)[0]
    const targetRun = resumable ?? latestRun
    if (targetRun) {
      setBusyAssignmentId(null)
      navigate(`/teacher/test-runs/${targetRun.id}?assignmentId=${assignment.id}`)
      return
    }
    const sections = await listTestSections(assignment.packageVersionId)
    setBusyAssignmentId(null)
    if (!sections.ok || !sections.data[0]) {
      setMessage(sections.ok ? 'Package has no sessions.' : sections.error)
      return
    }
    navigate(`/teacher/tests/${assignment.id}/sections/${sections.data[0].id}/setup`)
  }

  async function removeAssignment(assignment: StandaloneTestAssignmentRow) {
    const learnerName = learners.find((l) => l.id === assignment.learnerUserId)?.displayName ?? 'this learner'
    if (
      !window.confirm(
        `Delete standalone test assignment #${assignment.assignmentNumber} for ${learnerName}? This removes its runs, item attempts, events, and snapshots.`,
      )
    ) {
      return
    }
    setBusyAssignmentId(assignment.id)
    const result = await deleteStandaloneAssignment(assignment.id)
    setBusyAssignmentId(null)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setSelectedAssignmentIds((current) => {
      const next = new Set(current)
      next.delete(assignment.id)
      return next
    })
    setMessage('Deleted standalone test assignment.')
    await loadAssignments()
  }

  function toggleAssignmentSelection(assignmentId: string) {
    setSelectedAssignmentIds((current) => {
      const next = new Set(current)
      if (next.has(assignmentId)) next.delete(assignmentId)
      else next.add(assignmentId)
      return next
    })
  }

  async function removeSelectedAssignments() {
    const selectedAssignments = filteredAssignments.filter((assignment) => selectedAssignmentIds.has(assignment.id))
    if (selectedAssignments.length === 0) return
    if (
      !window.confirm(
        `Delete ${selectedAssignments.length} standalone test assignment${selectedAssignments.length === 1 ? '' : 's'}? This removes their runs, item attempts, events, and snapshots.`,
      )
    ) {
      return
    }
    for (const assignment of selectedAssignments) {
      setBusyAssignmentId(assignment.id)
      const result = await deleteStandaloneAssignment(assignment.id)
      if (!result.ok) {
        setBusyAssignmentId(null)
        setMessage(result.error)
        return
      }
    }
    setBusyAssignmentId(null)
    setSelectedAssignmentIds(new Set())
    setMessage(`Deleted ${selectedAssignments.length} standalone test assignment${selectedAssignments.length === 1 ? '' : 's'}.`)
    await loadAssignments()
  }

  const visibleAssignmentIds = filteredAssignments.map((assignment) => assignment.id)
  const visibleSelectedCount = visibleAssignmentIds.filter((id) => selectedAssignmentIds.has(id)).length
  const allSelected = visibleAssignmentIds.length > 0 && visibleSelectedCount === visibleAssignmentIds.length
  const statusBadgeClass = (status: string) => {
    if (status === 'completed') return 'badge completed'
    if (status === 'active') return 'badge success'
    return 'badge info'
  }
  const packageLabel = (versionId: string) =>
    versions.find((version) => version.id === versionId)?.label ?? 'Unknown package'

  const assignmentKind = (verId: string): PackageKind =>
    versions.find((v) => v.id === verId)?.kind ?? 'standard'

  const selectableVersions = useMemo(() => {
    if (packageTypeTab === 'all') return versions
    return versions.filter((v) => v.testType === packageTypeTab)
  }, [versions, packageTypeTab])

  useEffect(() => {
    if (selectableVersions.length > 0) {
      const exists = selectableVersions.some((v) => v.id === versionId)
      if (!exists) {
        setVersionId(selectableVersions[0].id)
      }
    }
  }, [selectableVersions, versionId])

  const progressLabel = (assignmentId: string) => {
    const progress = assignmentProgress[assignmentId] ?? {
      assignmentId,
      completedQuestions: 0,
      totalQuestions: 0,
    }
    const pct = progress.totalQuestions
      ? Math.round((progress.completedQuestions / progress.totalQuestions) * 100)
      : 0
    return `${pct}% complete · ${progress.completedQuestions}/${progress.totalQuestions} questions`
  }

  return (
    <div className="tests-page">
      <PageHeader
        icon={ClipboardCheck}
        kicker="Teacher"
        title="Tests 1-1"
        subtitle="One Learner · standalone package sessions · dedicated test room and analysis."
      />
      <Panel
        icon={Play}
        title="New one-to-one Test"
        description="Select exactly one active Learner and a published canonical package."
        collapsible={false}
      >
        <div className="form-grid">
          <label>
            Learner
            <select value={learnerId} onChange={(event) => setLearnerId(event.target.value)}>
              <option value="">Select Learner</option>
              {learners.map((learner) => (
                <option key={learner.id} value={learner.id}>
                  {learner.displayName}
                </option>
              ))}
            </select>
          </label>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-700">Package</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    packageTypeTab === 'all'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setPackageTypeTab('all')}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    packageTypeTab === 'green'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                  onClick={() => setPackageTypeTab('green')}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Green test</span>
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    packageTypeTab === 'red'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                  onClick={() => setPackageTypeTab('red')}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>Red test</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <select
                aria-label="Package"
                value={versionId}
                onChange={(event) => setVersionId(event.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold text-xs shadow-2xs hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 transition-all cursor-pointer"
              >
                <option value="">Select published package</option>
                {selectableVersions.map((v) => (
                  <option key={v.id} value={v.id} className="py-1 font-semibold text-slate-800">
                    {v.testType === 'green' ? '🟢 ' : '🔴 '}
                    {v.label}
                    {v.kind === 'mini' ? ' (⚡ Mini · 21 câu)' : ' (Standard · 49 câu)'}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const sel = versions.find((v) => v.id === versionId)
              if (!sel) return null
              return (
                <div className="flex flex-wrap items-center gap-2 pt-1.5 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wider shrink-0 ${
                      sel.testType === 'green'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {sel.testType} test
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {sel.label}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0 ${
                      sel.kind === 'mini'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {sel.kind === 'mini' ? '⚡ Mini · 21 câu hỏi (7 session x 3 câu)' : 'Standard · 49 câu hỏi (7 session x 7 câu)'}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>
        {message ? <p className="meta text-slate-600">{message}</p> : null}
        <button className="primary" onClick={() => void start()} disabled={!learnerId || !versionId}>
          <Play className="h-4 w-4" /> Create assignment
        </button>
      </Panel>

      <Panel
        icon={UserRound}
        title="Assignments"
        description="Delete old test trials or open dedicated standalone analysis."
        actions={assignments.length > 0 ? (
          <div className="test-assignment-bulk-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (allSelected) {
                  setSelectedAssignmentIds((current) => {
                    const next = new Set(current)
                    for (const id of visibleAssignmentIds) next.delete(id)
                    return next
                  })
                } else {
                  setSelectedAssignmentIds((current) => new Set([...current, ...visibleAssignmentIds]))
                }
              }}
            >
              {allSelected ? 'Clear' : 'Select all'}
            </button>
            <button
              type="button"
              className="ghost danger"
              onClick={() => void removeSelectedAssignments()}
              disabled={visibleSelectedCount === 0 || busyAssignmentId !== null}
            >
              <Trash2 className="h-4 w-4" /> Delete selected {visibleSelectedCount ? `(${visibleSelectedCount})` : ''}
            </button>
          </div>
        ) : null}
        collapsible={false}
      >
        {assignments.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No standalone assignments" />
        ) : (
          <>
            <div className="analysis-filter-row mb-3">
              <label className="analysis-filter-block analysis-filter-grow">
                <span className="analysis-filter-label">Search learner</span>
                <input
                  className="analysis-select"
                  type="search"
                  value={assignmentLearnerSearch}
                  onChange={(event) => setAssignmentLearnerSearch(event.target.value)}
                  placeholder="Name, email, or learner ID"
                />
              </label>
              <label className="analysis-filter-block">
                <span className="analysis-filter-label">Package test</span>
                <select
                  className="analysis-select"
                  value={assignmentPackageFilter}
                  onChange={(event) => setAssignmentPackageFilter(event.target.value)}
                >
                  <option value="all">All packages</option>
                  <option value="standard">Standard tests (49Q)</option>
                  <option value="mini">Mini-tests (21Q)</option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="analysis-filter-block">
                <span className="analysis-filter-label">Status</span>
                <select
                  className="analysis-select"
                  value={assignmentStatusFilter}
                  onChange={(event) => setAssignmentStatusFilter(event.target.value as typeof assignmentStatusFilter)}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </div>

            {filteredAssignments.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No assignments match filters" description="Clear search or switch filters." />
            ) : (
              <div className="table-wrap">
                <table>
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        if (allSelected) {
                          setSelectedAssignmentIds((current) => {
                            const next = new Set(current)
                            for (const id of visibleAssignmentIds) next.delete(id)
                            return next
                          })
                        } else {
                          setSelectedAssignmentIds((current) => new Set([...current, ...visibleAssignmentIds]))
                        }
                      }}
                      aria-label={allSelected ? 'Clear selected assignments' : 'Select all assignments'}
                    />
                  </th>
                  <th>Learner</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className={selectedAssignmentIds.has(assignment.id) ? 'is-selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedAssignmentIds.has(assignment.id)}
                        onChange={() => toggleAssignmentSelection(assignment.id)}
                        aria-label={`Select assignment #${assignment.assignmentNumber}`}
                      />
                    </td>
                    <td>
                      <strong>
                        {learners.find((learner) => learner.id === assignment.learnerUserId)?.displayName ??
                          assignment.learnerUserId}
                      </strong>
                      <div className="test-assignment-meta flex items-center gap-1.5 mt-0.5">
                        <span>{packageLabel(assignment.packageVersionId)}</span>
                        {assignmentKind(assignment.packageVersionId) === 'mini' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                            Mini · 21Q
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                            Standard · 49Q
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={statusBadgeClass(assignment.status)}>{assignment.status}</span>
                      {assignment.status === 'active' ? (
                        <div className="test-assignment-meta">{progressLabel(assignment.id)}</div>
                      ) : null}
                    </td>
                    <td className="test-assignment-date">
                      {new Date(assignment.assignedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="test-assignment-actions">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => void openOrResumeAssignment(assignment)}
                          disabled={busyAssignmentId === assignment.id}
                          title="Open or resume the latest test session"
                        >
                          {assignment.status === 'completed' ? <ExternalLink className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />} Open
                        </button>
                        <Link
                          className="btn ghost"
                          to={`/teacher/tests/analysis/${assignment.id}`}
                          title="Open standalone analysis"
                        >
                          <BarChart3 className="h-4 w-4" /> Analysis
                        </Link>
                        <button
                          type="button"
                          className="ghost danger"
                          onClick={() => void removeAssignment(assignment)}
                          disabled={busyAssignmentId === assignment.id}
                          title="Delete assignment"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
