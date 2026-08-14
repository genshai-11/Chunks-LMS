import type { ResultColor } from '../result-lifecycle/types'

export type ProbeAction = {
  outcome: 'fail' | 'continue' | 'done'
  color: ResultColor
  label: string
  subLabel: string
  shortcut: string
  className: string
}

export const PROBE_ACTIONS: ProbeAction[] = [
  {
    outcome: 'fail',
    color: 'yellow',
    label: 'Yellow',
    subLabel: 'Fail',
    shortcut: 'F',
    className: 'probe-yellow',
  },
  {
    outcome: 'continue',
    color: 'blue',
    label: 'Blue',
    subLabel: 'Continue',
    shortcut: 'C',
    className: 'probe-blue',
  },
  {
    outcome: 'done',
    color: 'indigo',
    label: 'Indigo',
    subLabel: 'Done',
    shortcut: 'D',
    className: 'probe-indigo',
  },
]
