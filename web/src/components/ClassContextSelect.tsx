import { School } from 'lucide-react'
import type { ClassOption } from '../modules/roster/class-context'
import type { LearnerEnrollmentOption } from '../modules/roster/class-context'

type TeacherProps = {
  variant: 'teacher'
  options: ClassOption[]
  value: string | null
  onChange: (classId: string) => void
  /** compact for sidebar */
  compact?: boolean
}

type LearnerProps = {
  variant: 'learner'
  options: LearnerEnrollmentOption[]
  value: string | null
  onChange: (classId: string) => void
  compact?: boolean
}

type AdminProps = {
  variant: 'admin'
  options: ClassOption[]
  value: string | null
  onChange: (classId: string) => void
  compact?: boolean
}

type Props = TeacherProps | LearnerProps | AdminProps

/** Class / enrollment switcher for role workspaces and admin analysis. */
export function ClassContextSelect(props: Props) {
  const { value, onChange, compact } = props

  if (props.options.length === 0) {
    return (
      <p className={`class-context-empty${compact ? ' is-compact' : ''}`}>
        <School className="h-3.5 w-3.5" aria-hidden />
        No classes
      </p>
    )
  }

  if (props.options.length === 1 && compact) {
    const label =
      props.variant === 'learner'
        ? props.options[0]!.classRow.name
        : `${props.options[0]!.classRow.name}${
            props.options[0]!.course?.code ? ` · ${props.options[0]!.course.code}` : ''
          }`
    return (
      <p className="class-context-single" title={label}>
        <School className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </p>
    )
  }

  return (
    <label className={`class-context-select${compact ? ' is-compact' : ''}`}>
      <span className="sr-only">Class</span>
      <School className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select class"
      >
        {props.variant === 'learner'
          ? props.options.map((o) => (
              <option key={o.classRow.id} value={o.classRow.id}>
                {o.classRow.name}
                {o.course?.code ? ` · ${o.course.code}` : ''}
              </option>
            ))
          : props.options.map((o) => (
              <option key={o.classRow.id} value={o.classRow.id}>
                {o.classRow.name}
                {o.course?.code ? ` · ${o.course.code}` : ''}
                {props.variant === 'teacher' || props.variant === 'admin'
                  ? ` · ${o.seats}/${o.classRow.capacity}`
                  : ''}
              </option>
            ))}
      </select>
    </label>
  )
}
