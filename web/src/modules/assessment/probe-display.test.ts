import { describe, expect, it } from 'vitest'
import { formatProbeCell, formatProbeLive, probeDepthMax, probeN } from './probe-display'
import { createDraftSnapshot } from '../result-lifecycle/state-machine'
import { applyLifecycleCommand } from '../result-lifecycle/state-machine'

const at = '2026-07-12T10:00:00.000Z'

describe('probe-display', () => {
  it('treats n as probeCount after Green, not sample size', () => {
    let r = applyLifecycleCommand(createDraftSnapshot(3), {
      type: 'record_provisional',
      color: 'green',
      at,
    })
    if (!r.ok) throw new Error(r.error)
    expect(probeN(r.snapshot)).toBe(0)

    r = applyLifecycleCommand(r.snapshot, { type: 'resolve_probe', outcome: 'continue', at })
    if (!r.ok) throw new Error(r.error)
    expect(probeN(r.snapshot)).toBe(1)
    expect(probeDepthMax(r.snapshot)).toBe(3)
    expect(formatProbeCell(r.snapshot)).toBe('n depth=1')
  })

  it('formatProbeLive shows n depth and ceiling', () => {
    expect(formatProbeLive(2, 5)).toEqual({
      nLabel: 'n depth=2',
      depthLabel: 'ceiling 5',
    })
  })
})

