import { useCallback, useEffect, useState } from 'react'
import { BarChart3, ClipboardCheck, ExternalLink, Play, RotateCcw, Trash2, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { listActiveLearners } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'
import { listTestItems, listTestPackages, listTestPackageVersions, listTestSections } from '../../lib/test-packages'
import {
  createStandaloneAssignment,
  deleteStandaloneAssignment,
  getStandaloneAssignmentProgress,
  listStandaloneAssignments,
  listStandaloneRuns,
  type StandaloneAssignmentProgress,
  type StandaloneTestAssignmentRow,
} from '../../lib/standalone-tests'

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
  const [versions, setVersions] = useState<Array<{ id: string; label: string }>>([])
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
      const next: Array<{ id: string; label: string }> = []
      for (const pkg of packages.data) {
        const result = await listTestPackageVersions(pkg.id)
        if (result.ok) {
          for (const version of result.data.filter((v) => v.status === 'published')) {
            next.push({ id: version.id, label: `${pkg.title} · ${version.versionLabel}` })
          }
        }
      }
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
    if (assignmentPackageFilter !== 'all' && assignment.packageVersionId !== assignmentPackageFilter) return false
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
          <label>
            Package
            <select value={versionId} onChange={(event) => setVersionId(event.target.value)}>
              <option value="">Select published package</option>
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {message ? <p className="meta text-slate-700 dark:text-slate-200">{message}</p> : null}
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
                      <div className="test-assignment-meta">
                        {packageLabel(assignment.packageVersionId)}
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
