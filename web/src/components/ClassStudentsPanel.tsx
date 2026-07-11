import { useMemo, useState } from 'react'
import {
  Ban,
  ClipboardCopy,
  GraduationCap,
  ImagePlus,
  Link2,
  Mail,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { readImageAsDataUrl } from '../lib/readImageFile'
import {
  activeEnrollmentsForClass,
  classInviteLines,
  createLearnerAndEnroll,
  endEnrollment,
  enrollLearner,
  formatClassInviteClipboard,
  learnerInviteMailto,
  learnerInviteUrl,
  learnersAvailableForClass,
} from '../modules/roster/service'
import { useAppState } from '../state/useAppState'
import { UserAvatar } from './UserAvatar'
import { EmptyState } from './ui'

type Props = {
  classId: string
  /** Compact embed under a course card */
  compact?: boolean
  onMessage?: (msg: string) => void
  onError?: (msg: string) => void
}

/**
 * Seat learners into a class from Courses/Classes admin workflow:
 * - list roster with avatars
 * - enroll existing directory learner
 * - quick-add new learner (profile + seat)
 * - copy / email portal invite links (share-link V1 — no Clerk for learners)
 */
export function ClassStudentsPanel({ classId, compact, onMessage, onError }: Props) {
  const { roster, setRoster } = useAppState()
  const klass = roster.classes.find((c) => c.id === classId)
  const [existingId, setExistingId] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newAvatar, setNewAvatar] = useState<string | null>(null)
  const [tab, setTab] = useState<'existing' | 'new'>('new')

  const active = useMemo(
    () => (klass ? activeEnrollmentsForClass(roster, klass.id) : []),
    [roster, klass],
  )
  const available = useMemo(
    () => (klass ? learnersAvailableForClass(roster, klass.id) : []),
    [roster, klass],
  )
  const inviteReady = useMemo(
    () => (klass ? classInviteLines(roster, klass.id) : []),
    [roster, klass],
  )

  if (!klass) {
    return <EmptyState icon={Users} title="Class not found" />
  }

  const full = active.length >= klass.capacity
  const seatsLabel = `${active.length}/${klass.capacity} seats`
  const missingEmail = active.filter((e) => {
    const u = roster.users.find((x) => x.id === e.learnerUserId)
    return !u?.email?.trim()
  }).length

  function ok(msg: string) {
    onMessage?.(msg)
  }
  function err(msg: string) {
    onError?.(msg)
  }

  async function copyText(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text)
      ok(success)
    } catch {
      ok(text)
    }
  }

  return (
    <div className={`class-students${compact ? ' is-compact' : ''}`}>
      <div className="class-students-head">
        <div>
          <p className="class-students-title">
            <GraduationCap className="h-4 w-4" aria-hidden />
            Students in {klass.name}
          </p>
          <p className="meta">
            {seatsLabel}
            {klass.status !== 'active' ? ' · class not active' : ''}
            {inviteReady.length > 0 ? ` · ${inviteReady.length} invite ready` : ''}
            {missingEmail > 0 ? ` · ${missingEmail} missing email` : ''}
          </p>
        </div>
        <span className={`badge${full ? '' : ' success'}`}>{seatsLabel}</span>
      </div>

      {inviteReady.length > 0 ? (
        <div className="class-students-invite-bar">
          <button
            type="button"
            className="ghost"
            title="Copy all portal links"
            onClick={() =>
              void copyText(
                formatClassInviteClipboard(roster, klass.id),
                `Copied ${inviteReady.length} invite link(s)`,
              )
            }
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
            <span>Copy all links</span>
          </button>
        </div>
      ) : null}

      {active.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Add a student with email to get a shareable portal link."
        />
      ) : (
        <ul className="person-list class-students-list">
          {active.map((e) => {
            const user = roster.users.find((u) => u.id === e.learnerUserId)
            const url = user ? learnerInviteUrl(user) : null
            const mailto = user ? learnerInviteMailto(user) : null
            return (
              <li key={e.id} className="person-row">
                <UserAvatar
                  name={user?.displayName ?? e.learnerUserId}
                  avatarUrl={user?.avatarUrl}
                  size="md"
                />
                <div className="person-body">
                  <strong>{user?.displayName ?? e.learnerUserId}</strong>
                  <span>
                    {user?.email ?? 'No email — required for invite link'}
                    {url ? ' · invite ready' : ''}
                  </span>
                </div>
                <div className="row-actions">
                  {url ? (
                    <button
                      type="button"
                      className="ghost"
                      title="Copy portal invite link"
                      onClick={() =>
                        void copyText(url, `Invite link copied for ${user?.displayName}`)
                      }
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
                      <span>Copy</span>
                    </button>
                  ) : null}
                  {mailto ? (
                    <a className="btn ghost" href={mailto} title="Open email with invite link">
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      <span>Email</span>
                    </a>
                  ) : null}
                  {klass.status === 'active' ? (
                    <button
                      type="button"
                      className="ghost danger"
                      onClick={() => {
                        if (!window.confirm(`Remove ${user?.displayName ?? 'learner'} from class?`)) {
                          return
                        }
                        const r = endEnrollment(roster, e.id)
                        if (!r.ok) return err(r.error)
                        setRoster(r.state)
                        ok(`${user?.displayName ?? 'Learner'} removed from class`)
                      }}
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden />
                      <span>Remove</span>
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {klass.status === 'active' ? (
        <div className="class-students-add">
          <div className="subnav class-students-tabs" role="tablist" aria-label="Add student">
            <button
              type="button"
              role="tab"
              className={tab === 'new' ? 'is-active' : undefined}
              aria-selected={tab === 'new'}
              onClick={() => setTab('new')}
            >
              New student
            </button>
            <button
              type="button"
              role="tab"
              className={tab === 'existing' ? 'is-active' : undefined}
              aria-selected={tab === 'existing'}
              onClick={() => setTab('existing')}
            >
              From directory
            </button>
          </div>

          {tab === 'new' ? (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault()
                if (full) return err(`Class is full (${klass.capacity})`)
                if (!newEmail.trim()) {
                  return err('Email is required so you can share a portal login link')
                }
                const r = createLearnerAndEnroll(roster, klass.id, {
                  displayName: newName,
                  email: newEmail,
                  avatarUrl: newAvatar,
                })
                if (!r.ok) return err(r.error)
                setRoster(r.state)
                const invite = learnerInviteUrl(r.value.learner)
                ok(
                  invite
                    ? `${r.value.learner.displayName} seated · invite ready — Copy or Email`
                    : `${r.value.learner.displayName} added`,
                )
                setNewName('')
                setNewEmail('')
                setNewAvatar(null)
              }}
            >
              <div className="form-span-full avatar-field">
                <UserAvatar name={newName || 'Student'} avatarUrl={newAvatar} size="lg" />
                <div className="avatar-field-actions">
                  <label className="btn ghost avatar-file-label">
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                    <span>{newAvatar ? 'Change photo' : 'Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (ev) => {
                        const file = ev.target.files?.[0]
                        ev.target.value = ''
                        if (!file) return
                        try {
                          setNewAvatar(await readImageAsDataUrl(file))
                        } catch (error) {
                          err(error instanceof Error ? error.message : 'Could not read image')
                        }
                      }}
                    />
                  </label>
                  {newAvatar ? (
                    <button type="button" className="ghost danger" onClick={() => setNewAvatar(null)}>
                      <X className="h-3.5 w-3.5" aria-hidden />
                      <span>Remove</span>
                    </button>
                  ) : null}
                </div>
              </div>
              <label>
                Name
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="Learner name"
                  disabled={full}
                />
              </label>
              <label>
                Email (portal login)
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="learner@school.edu"
                  required
                  disabled={full}
                />
              </label>
              <p className="meta form-span-full">
                After seating, use <strong>Copy</strong> or <strong>Email</strong> to send their
                login link. Learners do not use Clerk.
              </p>
              <button type="submit" className="primary" disabled={full}>
                <UserPlus className="h-4 w-4" aria-hidden />
                <span>Add &amp; seat</span>
              </button>
            </form>
          ) : (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault()
                if (!existingId) return err('Select a learner')
                if (full) return err(`Class is full (${klass.capacity})`)
                const r = enrollLearner(roster, klass.id, existingId)
                if (!r.ok) return err(r.error)
                const learner = roster.users.find((u) => u.id === existingId)
                const name = learner?.displayName ?? 'Learner'
                setRoster(r.state)
                if (learnerInviteUrl(learner!)) {
                  ok(`${name} enrolled · invite ready`)
                } else {
                  ok(`${name} enrolled — add email on People to enable invite link`)
                }
                setExistingId('')
              }}
            >
              <label className="form-span-full">
                Learner
                <select
                  value={existingId}
                  onChange={(e) => setExistingId(e.target.value)}
                  disabled={full || available.length === 0}
                  required
                >
                  <option value="">
                    {available.length === 0
                      ? 'No other learners in directory'
                      : 'Select learner…'}
                  </option>
                  {available.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                      {u.email ? ` · ${u.email}` : ' · no email'}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="primary"
                disabled={full || available.length === 0 || !existingId}
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                <span>Enroll</span>
              </button>
            </form>
          )}

          {full ? (
            <p className="meta class-students-full">
              Class is full. Raise capacity or remove a student to add more.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="meta">Restore the class to add or remove students.</p>
      )}
    </div>
  )
}
