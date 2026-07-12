export type ProbeAction = {
  outcome: 'fail' | 'continue' | 'done'
  label: 'Fail' | 'Pass' | 'Done'
  shortcut: 'F' | 'P' | 'D'
  className: 'fail' | 'pass' | 'done'
}

/** UI labels are neutral aliases; stored lifecycle outcomes remain unchanged. */
export const PROBE_ACTIONS: ProbeAction[] = [
  { outcome: 'fail', label: 'Fail', shortcut: 'F', className: 'fail' },
  { outcome: 'continue', label: 'Pass', shortcut: 'P', className: 'pass' },
  { outcome: 'done', label: 'Done', shortcut: 'D', className: 'done' },
]
