import { useMemo, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { ClassContextSelect } from '../../components/ClassContextSelect'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/ui'
import { buildAttendanceMatrix } from '../../modules/ops/attendance-matrix'
import {
  listAdminClassOptions,
  resolveActiveClassId,
} from '../../modules/roster/class-context'
import { useAppState } from '../../state/useAppState'

const STATUS_LABEL: Record<string, string> = {
  present: 'P',
  late: 'L',
  absent: 'A',
  excused: 'E',
  missing: '·',
}

export function AdminAttendancePage() {
  const { roster, scheduling } = useAppState()
  const [params] = useSearchParams()
  const options = useMemo(() => listAdminClassOptions(roster), [roster])
  const [selectedId, setSelectedId] = useState<string | null>(
    () => params.get('class') ?? resolveActiveClassId(
      options.map((o) => o.classRow),
      null,
    ),
  )

  const activeId = resolveActiveClassId(
    options.map((o) => o.classRow),
    selectedId,
  )
  const matrix = activeId ? buildAttendanceMatrix(roster, scheduling, activeId) : null

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        kicker="Admin"
        title="Attendance matrix"
        subtitle="Class × learning day — present, late, absent, excused."
        actions={
          <ClassContextSelect
            variant="admin"
            options={options}
            value={activeId}
            onChange={setSelectedId}
          />
        }
      />

      {!matrix || matrix.sessions.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No learning sessions yet"
          description="Attendance appears after teachers start sessions and mark the roster."
        />
      ) : (
        <div className="table-wrap attendance-matrix-wrap">
          <table className="attendance-matrix">
            <thead>
              <tr>
                <th scope="col">Learner</th>
                {matrix.sessions.map((s) => (
                  <th key={s.id} scope="col" title={new Date(s.startedAt).toLocaleString()}>
                    {s.sessionNumber != null ? `D${s.sessionNumber}` : '·'}
                    <div className="meta" style={{ fontWeight: 400 }}>
                      {s.status === 'open' ? 'live' : 'done'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.learnerUserId}>
                  <th scope="row">{row.displayName}</th>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.learningSessionId}
                      className={`att-cell is-${cell.status}`}
                      title={cell.status}
                    >
                      {STATUS_LABEL[cell.status] ?? '·'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="meta mt-3">
            Legend: P present · L late · A absent · E excused · · missing
          </p>
        </div>
      )}
    </>
  )
}
