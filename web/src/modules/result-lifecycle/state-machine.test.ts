import { describe, expect, it } from 'vitest'
import { applyLifecycleCommand, createDraftSnapshot, isFinalizedForMetrics } from './state-machine'

const at = '2026-07-11T10:00:00.000Z'

describe('result lifecycle state machine', () => {
  it('finalizes Red, Orange, and Purple directly with 1-element recordedColors', () => {
    for (const color of ['red', 'orange', 'purple'] as const) {
      const draft = createDraftSnapshot()
      const result = applyLifecycleCommand(draft, {
        type: 'record_provisional',
        color,
        at,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.snapshot.status).toBe('finalized')
      expect(result.snapshot.effectiveColor).toBe(color)
      expect(result.snapshot.recordedColors).toEqual([color])
      expect(isFinalizedForMetrics(result.snapshot)).toBe(true)
      expect(result.events).toEqual(['provisional_recorded', 'result_finalized'])
    }
  })

  it('opens probe flow on Green and sets initial recordedColors to [green]', () => {
    const result = applyLifecycleCommand(createDraftSnapshot(), {
      type: 'record_provisional',
      color: 'green',
      at,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.snapshot.status).toBe('probe_open')
    expect(result.snapshot.enteredProbeFlow).toBe(true)
    expect(result.snapshot.recordedColors).toEqual(['green'])
    expect(isFinalizedForMetrics(result.snapshot)).toBe(false)
  })

  it('Green then Fail finalizes Yellow with [green, yellow]', () => {
    let snap = createDraftSnapshot()
    let r = applyLifecycleCommand(snap, { type: 'record_provisional', color: 'green', at })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    snap = r.snapshot
    r = applyLifecycleCommand(snap, { type: 'resolve_probe', outcome: 'fail', at })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snapshot.effectiveColor).toBe('yellow')
    expect(r.snapshot.status).toBe('finalized')
    expect(r.snapshot.recordedColors).toEqual(['green', 'yellow'])
    expect(r.events).toContain('probe_failed')
  })

  it('Green then Done finalizes Indigo with [green, indigo]', () => {
    let snap = createDraftSnapshot()
    let r = applyLifecycleCommand(snap, { type: 'record_provisional', color: 'green', at })
    if (!r.ok) throw new Error(r.error)
    r = applyLifecycleCommand(r.snapshot, { type: 'resolve_probe', outcome: 'done', at })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snapshot.effectiveColor).toBe('indigo')
    expect(r.snapshot.recordedColors).toEqual(['green', 'indigo'])
  })

  it('Continue appends Blue and Done appends Indigo preserving full sequence', () => {
    let snap = createDraftSnapshot(2)
    let r = applyLifecycleCommand(snap, { type: 'record_provisional', color: 'green', at })
    if (!r.ok) throw new Error(r.error)

    // Two Continue steps (Blue)
    r = applyLifecycleCommand(r.snapshot, { type: 'resolve_probe', outcome: 'continue', at })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snapshot.recordedColors).toEqual(['green', 'blue'])
    expect(r.snapshot.probeCount).toBe(1)

    r = applyLifecycleCommand(r.snapshot, { type: 'resolve_probe', outcome: 'continue', at })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snapshot.recordedColors).toEqual(['green', 'blue', 'blue'])
    expect(r.snapshot.probeCount).toBe(2)

    // Complete with Done (Indigo)
    const done = applyLifecycleCommand(r.snapshot, {
      type: 'resolve_probe',
      outcome: 'done',
      at,
    })
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.snapshot.effectiveColor).toBe('indigo')
    expect(done.snapshot.recordedColors).toEqual(['green', 'blue', 'blue', 'indigo'])
    expect(done.snapshot.recordedColors.length).toBe(4)
    expect(done.snapshot.probeCount).toBe(3)
  })

  it('corrections require reason and preserve finalization path', () => {
    let r = applyLifecycleCommand(createDraftSnapshot(), {
      type: 'record_provisional',
      color: 'red',
      at,
    })
    if (!r.ok) throw new Error(r.error)

    const bad = applyLifecycleCommand(r.snapshot, {
      type: 'correct',
      color: 'purple',
      reason: '  ',
      at,
      actorId: 'user-1',
    })
    expect(bad.ok).toBe(false)

    r = applyLifecycleCommand(r.snapshot, {
      type: 'correct',
      color: 'purple',
      reason: 'Mis-tap',
      at,
      actorId: 'user-1',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snapshot.status).toBe('corrected')
    expect(r.snapshot.effectiveColor).toBe('purple')
    expect(isFinalizedForMetrics(r.snapshot)).toBe(true)
  })

  it('rejects probe on non-green draft path', () => {
    const r = applyLifecycleCommand(createDraftSnapshot(), {
      type: 'resolve_probe',
      outcome: 'done',
      at,
    })
    expect(r.ok).toBe(false)
  })
})
