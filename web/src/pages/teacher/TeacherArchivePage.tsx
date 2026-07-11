import { useMemo, useState } from 'react'
import { Archive, CalendarDays } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { buildSessionArchive, learnerNameMap } from '../../modules/ops/session-archive'
import { useAppState } from '../../state/useAppState'

/**
 * Completed learning days for the active class — read-only color heatmap.
 */
export function TeacherArchivePage() {
  const { roster, scheduling, ledger } = useAppState()
  const { classRow, course } = useTeacherClassContext()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const archive = useMemo(
    () =>
      classRow ? buildSessionArchive(roster, scheduling, ledger, classRow.id) : [],
    [roster, scheduling, ledger, classRow],
  )

  const names = useMemo(() => learnerNameMap(roster), [roster])
  const selected =
    archive.find((d) => d.learningSession.id === selectedId) ?? archive[archive.length - 1] ?? null

  if (!classRow) {
    return (
      <>
        <PageHeader icon={Archive} kicker="Teacher" title="Session archive" />
        <EmptyState icon={Archive} title="No class selected" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon={Archive}
        kicker={course?.code ?? 'Class'}
        title="Session archive"
        subtitle={`${classRow.name} — completed days and result map (read-only)`}
      />

      {archive.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No learning sessions yet"
          description="Start a live session from Schedule; completed days appear here."
        />
      ) : (
        <div className="archive-layout">
          <Panel icon={CalendarDays} title="Learning days" description="Select a day.">
            <ul className="person-list">
              {archive.map((day) => {
                const active = selected?.learningSession.id === day.learningSession.id
                return (
                  <li key={day.learningSession.id}>
                    <button
                      type="button"
                      className={`archive-day-btn${active ? ' is-active' : ''}`}
                      onClick={() => setSelectedId(day.learningSession.id)}
                    >
                      <strong>{day.dayLabel}</strong>
                      <span className="meta">
                        {day.learningSession.status} · {day.resultCount} results · att{' '}
                        {day.attendancePresent}/{day.attendanceTotal || '—'}
                      </span>
                      <span className="meta font-mono">
                        {new Date(day.learningSession.startedAt).toLocaleString()}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel
            icon={Archive}
            title={selected ? selected.dayLabel : 'Day detail'}
            description="Read-only heatmap of finalized colors."
          >
            {!selected || selected.cells.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="No finalized results"
                description="This day has no finalized observations yet."
              />
            ) : (
              <div className="archive-heat" role="list" aria-label="Result map">
                {selected.cells.map((cell) => (
                  <div
                    key={`${cell.sessionQuestionId}-${cell.learnerUserId}`}
                    className={`archive-heat-cell is-${cell.color ?? 'empty'}`}
                    role="listitem"
                    title={`Q${cell.sequenceHint} · ${names.get(cell.learnerUserId) ?? 'Learner'} · ${
                      cell.color ?? 'none'
                    }`}
                  >
                    <span className="archive-heat-q">Q{cell.sequenceHint}</span>
                    <span className="archive-heat-name">
                      {(names.get(cell.learnerUserId) ?? '?').split(' ')[0]}
                    </span>
                    <span className="archive-heat-color">{cell.color ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  )
}
