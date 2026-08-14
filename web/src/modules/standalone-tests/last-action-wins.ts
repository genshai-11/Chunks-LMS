export type PersistResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type CoordinatedActionResult = {
  revision: number
  kind: 'committed' | 'stale' | 'rolled-back'
}

type ActionOptions<T> = {
  key: string
  optimistic: (revision: number) => void
  persist: (revision: number) => Promise<PersistResult<T>>
  commit: (data: T, revision: number) => void | Promise<void>
  rollback: (error: string, revision: number) => void | Promise<void>
}

/**
 * Applies optimistic actions immediately while allowing only the latest response for an item
 * to commit or roll back UI state. Revisions are also sent to the database RPC so stale
 * network arrivals cannot supersede a later durable command.
 */
export class LastActionWinsCoordinator {
  private latestRevision = new Map<string, number>()

  currentRevision(key: string): number {
    return this.latestRevision.get(key) ?? 0
  }

  seed(key: string, authoritativeRevision: number): void {
    if (!Number.isFinite(authoritativeRevision) || authoritativeRevision < 0) return
    this.latestRevision.set(
      key,
      Math.max(this.currentRevision(key), Math.floor(authoritativeRevision)),
    )
  }

  async run<T>(options: ActionOptions<T>): Promise<CoordinatedActionResult> {
    const revision = this.currentRevision(options.key) + 1
    this.latestRevision.set(options.key, revision)
    options.optimistic(revision)

    const result = await options.persist(revision)
    if (this.currentRevision(options.key) !== revision) {
      return { revision, kind: 'stale' }
    }
    if (result.ok) {
      await options.commit(result.data, revision)
      return { revision, kind: 'committed' }
    }
    await options.rollback(result.error, revision)
    return { revision, kind: 'rolled-back' }
  }
}
