import { describe, expect, it } from 'vitest'
import { LastActionWinsCoordinator, type PersistResult } from './last-action-wins'
import {
  correctionColorForShortcut,
  isStandaloneCorrectionMode,
  optimisticStandaloneProbePatch,
} from './result-entry-mode'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('standalone last-action-wins coordinator', () => {
  it('keeps Green → Indigo → Yellow on Yellow when RPC responses arrive out of order', async () => {
    const coordinator = new LastActionWinsCoordinator()
    const pending = [deferred<PersistResult<string>>(), deferred<PersistResult<string>>(), deferred<PersistResult<string>>()]
    let displayed = 'purple'
    let durable = 'purple'

    const issue = (color: string, requestIndex: number) =>
      coordinator.run({
        key: 'item-1',
        optimistic: () => {
          displayed = color
        },
        persist: async () => pending[requestIndex]!.promise,
        commit: (serverColor) => {
          displayed = serverColor
          durable = serverColor
        },
        rollback: () => {
          displayed = durable
        },
      })

    const green = issue('green', 0)
    const indigo = issue('indigo', 1)
    const yellow = issue('yellow', 2)
    expect(displayed).toBe('yellow')

    pending[1]!.resolve({ ok: true, data: 'indigo' })
    await indigo
    expect(displayed).toBe('yellow')

    pending[0]!.resolve({ ok: true, data: 'green' })
    await green
    expect(displayed).toBe('yellow')

    pending[2]!.resolve({ ok: true, data: 'yellow' })
    await yellow
    expect(displayed).toBe('yellow')
    expect(durable).toBe('yellow')
  })

  it('sends revision 3 when Yellow is clicked immediately after optimistic Indigo', async () => {
    const coordinator = new LastActionWinsCoordinator()
    const pending = [deferred<PersistResult<string>>(), deferred<PersistResult<string>>(), deferred<PersistResult<string>>()]
    const sentRevisions: number[] = []
    let state: { status: string; color: string | null } = { status: 'draft', color: null }
    let durable = 'purple'

    const green = coordinator.run({
      key: 'item-1',
      optimistic: () => {
        state = { status: 'probe_open', color: null }
      },
      persist: (revision) => {
        sentRevisions.push(revision)
        return pending[0]!.promise
      },
      commit: (color) => {
        durable = color
      },
      rollback: () => undefined,
    })

    const indigo = coordinator.run({
      key: 'item-1',
      optimistic: (revision) => {
        const patch = optimisticStandaloneProbePatch('done', 0, revision)
        state = { status: patch.status, color: patch.effective_color }
      },
      persist: (revision) => {
        sentRevisions.push(revision)
        return pending[1]!.promise
      },
      commit: (color) => {
        durable = color
      },
      rollback: () => undefined,
    })

    expect(state).toEqual({ status: 'finalized', color: 'indigo' })
    expect(isStandaloneCorrectionMode(state.status)).toBe(true)
    const yellowChoice = correctionColorForShortcut(state.status, 'f')
    expect(yellowChoice).toBe('yellow')

    const yellow = coordinator.run({
      key: 'item-1',
      optimistic: () => {
        state = { status: 'corrected', color: yellowChoice }
      },
      persist: (revision) => {
        sentRevisions.push(revision)
        return pending[2]!.promise
      },
      commit: (color) => {
        state = { status: 'corrected', color }
        durable = color
      },
      rollback: () => undefined,
    })

    expect(sentRevisions).toEqual([1, 2, 3])
    expect(state.color).toBe('yellow')

    pending[1]!.resolve({ ok: true, data: 'indigo' })
    pending[0]!.resolve({ ok: true, data: 'green' })
    pending[2]!.resolve({ ok: true, data: 'yellow' })
    await Promise.all([green, indigo, yellow])
    expect(durable).toBe('yellow')
    expect(state.color).toBe('yellow')
  })

  it('rolls back only the latest failed action to authoritative reloaded state', async () => {
    const coordinator = new LastActionWinsCoordinator()
    let displayed = 'indigo'
    const result = await coordinator.run({
      key: 'item-1',
      optimistic: () => {
        displayed = 'yellow'
      },
      persist: async () => ({ ok: false, error: 'network failure' }),
      commit: () => {
        throw new Error('must not commit')
      },
      rollback: async () => {
        displayed = 'indigo'
      },
    })

    expect(result.kind).toBe('rolled-back')
    expect(displayed).toBe('indigo')
  })
})
