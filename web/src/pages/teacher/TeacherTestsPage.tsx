import { useCallback, useEffect, useState } from 'react'
import { BarChart3, ClipboardCheck, ExternalLink, Play, RotateCcw, Trash2, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { listActiveLearners } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'
import { listTestPackages, listTestPackageVersions, listTestSections } from '../../lib/test-packages'
import {
  createStandaloneAssignment,
  deleteStandaloneAssignment,
  listStandaloneAssignments,
  listStandaloneRuns,
  type StandaloneTestAssignmentRow,
} from '../../lib/standalone-tests'

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
    const selectedAssignments = assignments.filter((assignment) => selectedAssignmentIds.has(assignment.id))
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

  const selectedCount = selectedAssignmentIds.size
  const allSelected = assignments.length > 0 && selectedCount === assignments.length
  const statusBadgeClass = (status: string) => {
    if (status === 'completed') return 'badge completed'
    if (status === 'active') return 'badge success'
    return 'badge info'
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
              onClick={() => setSelectedAssignmentIds(allSelected ? new Set() : new Set(assignments.map((assignment) => assignment.id)))}
            >
              {allSelected ? 'Clear' : 'Select all'}
            </button>
            <button
              type="button"
              className="ghost danger"
              onClick={() => void removeSelectedAssignments()}
              disabled={selectedCount === 0 || busyAssignmentId !== null}
            >
              <Trash2 className="h-4 w-4" /> Delete selected {selectedCount ? `(${selectedCount})` : ''}
            </button>
          </div>
        ) : null}
        collapsible={false}
      >
        {assignments.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No standalone assignments" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelectedAssignmentIds(allSelected ? new Set() : new Set(assignments.map((assignment) => assignment.id)))}
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
                {assignments.map((assignment) => (
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
                        Assignment #{assignment.assignmentNumber}
                      </div>
                    </td>
                    <td>
                      <span className={statusBadgeClass(assignment.status)}>{assignment.status}</span>
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
      </Panel>
    </div>
  )
}
