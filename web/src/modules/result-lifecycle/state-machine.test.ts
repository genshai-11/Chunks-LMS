import { describe, expect, it } from 'vitest'
import { applyLifecycleCommand, createDraftSnapshot, isFinalizedForMetrics } from './state-machine'

const at = '2026-07-11T10:00:00.000Z'

describe('result lifecycle state machine', () => {
  it('finalizes Red, Yellow, and Purple directly', () => {
    for (const color of ['red', 'yellow', 'purple'] as const) {
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
      expect(isFinalizedForMetrics(result.snapshot)).toBe(true)
      expect(result.events).toEqual(['provisional_recorded', 'result_finalized'])
    }
  })

  it('opens probe flow on Green and does not count until finalized', () => {
    const result = applyLifecycleCommand(createDraftSnapshot(), {
      type: 'record_provisional',
      color: 'green',
      at,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.snapshot.status).toBe('probe_open')
    expect(result.snapshot.enteredProbeFlow).toBe(true)
    expect(isFinalizedForMetrics(result.snapshot)).toBe(false)
  })

  it('Green then Fail finalizes Yellow with history', () => {
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
    expect(r.events).toContain('probe_failed')
  })

  it('Green then Done finalizes Green', () => {
    let snap = createDraftSnapshot()
    let r = applyLifecycleCommand(snap, { type: 'record_provisional', color: 'green', at })
    if (!r.ok) throw new Error(r.error)
    r = applyLifecycleCommand(r.snapshot, { type: 'resolve_probe', outcome: 'done', at })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snapshot.effectiveColor).toBe('green')
  })

  it('Continue below max keeps probe open; at max requires Fail or Done', () => {
    let snap = createDraftSnapshot(2)
    let r = applyLifecycleCommand(snap, { type: 'record_provisional', color: 'green', at })
    if (!r.ok) throw new Error(r.error)

    r = applyLifecycleCommand(r.snapshot, { type: 'resolve_probe', outcome: 'continue', at })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // first continue: probeCount 1 < max 2 → still open OR at boundary
    // with max=2: first continue → count=1, still open; second → count=2, resolution_required
    expect(r.snapshot.probeCount).toBe(1)
    expect(r.snapshot.status).toBe('probe_open')

    r = applyLifecycleCommand(r.snapshot, { type: 'resolve_probe', outcome: 'continue', at })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snapshot.status).toBe('resolution_required')
    expect(r.snapshot.probeCount).toBe(2)

    const cont = applyLifecycleCommand(r.snapshot, {
      type: 'resolve_probe',
      outcome: 'continue',
      at,
    })
    expect(cont.ok).toBe(false)

    const done = applyLifecycleCommand(r.snapshot, {
      type: 'resolve_probe',
      outcome: 'done',
      at,
    })
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.snapshot.effectiveColor).toBe('green')
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
