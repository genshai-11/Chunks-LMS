import { useMemo, useState } from 'react'
import {
  Check,
  GraduationCap,
  ImagePlus,
  Link2,
  Mail,
  Pencil,
  Power,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Flash } from '../../components/Flash'
import { readImageAsDataUrl } from '../../lib/readImageFile'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import {
  addLearnerProfile,
  addTeacherProfile,
  countDuplicateEmailGroups,
  deleteUserProfile,
  listActiveLearners,
  listActiveTeachers,
  listTeachersRaw,
  listLearnersRaw,
  mergeDuplicateAccountsByEmail,
  setAccountStatus,
  updateUserProfile,
} from '../../modules/roster/service'
import type { DomainUser } from '../../modules/roster/types'
import { useAppState } from '../../state/useAppState'

type Tab = 'teachers' | 'learners'
type Draft = { displayName: string; email: string; avatarUrl?: string }

const emptyDraft = (): Draft => ({ displayName: '', email: '', avatarUrl: '' })

function invitationUrl(user: DomainUser): string {
  const origin = window.location.origin
  if (user.roles.includes('learner') && user.email) {
    return `${origin}/access?email=${encodeURIComponent(user.email)}`
  }
  return `${origin}/teacher`
}

function invitationMailto(user: DomainUser): string {
  const link = invitationUrl(user)
  const isLearner = user.roles.includes('learner')
  const subject = encodeURIComponent(
    isLearner ? 'Chunks LMS learner invite' : 'Chunks LMS teacher invite',
  )
  const body = encodeURIComponent(
    isLearner
      ? `Hi ${user.displayName},\n\nOpen your portal:\n${link}\n`
      : `Hi ${user.displayName},\n\nSign in as Teacher:\n${link}\n`,
  )
  return `mailto:${encodeURIComponent(user.email ?? '')}?subject=${subject}&body=${body}`
}

export function AdminPeoplePage() {
  const { roster, setRoster, syncNow } = useAppState()
  const { message, error, ok, err } = useFlash()
  const [tab, setTab] = useState<Tab>('teachers')
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)

  const teachers = useMemo(() => listActiveTeachers(roster), [roster])
  const learners = useMemo(() => listActiveLearners(roster), [roster])
  const rawTeacherCount = useMemo(() => listTeachersRaw(roster).length, [roster])
  const rawLearnerCount = useMemo(() => listLearnersRaw(roster).length, [roster])
  const dupGroups = useMemo(() => countDuplicateEmailGroups(roster), [roster])

  const rows = tab === 'teachers' ? teachers : learners
  const rawCount = tab === 'teachers' ? rawTeacherCount : rawLearnerCount
  const hiddenDupes = Math.max(0, rawCount - rows.length)

  async function createAccount() {
    if (tab === 'teachers') {
      const r = addTeacherProfile(roster, {
        displayName: draft.displayName,
        email: draft.email || null,
        avatarUrl: draft.avatarUrl || null,
      })
      if (!r.ok) return err(r.error)
      setRoster(r.state)
      await syncNow({ roster: r.state })
      ok(`Teacher ${r.value.displayName} added`)
    } else {
      const r = addLearnerProfile(roster, {
        displayName: draft.displayName,
        email: draft.email.trim(),
        avatarUrl: draft.avatarUrl || null,
      })
      if (!r.ok) return err(r.error)
      setRoster(r.state)
      await syncNow({ roster: r.state })
      ok(`Learner ${r.value.displayName} added`)
    }
    setDraft(emptyDraft())
    setShowAdd(false)
  }

  async function saveEdit(id: string) {
    const r = updateUserProfile(roster, id, {
      displayName: editDraft.displayName,
      email: editDraft.email || null,
      avatarUrl: editDraft.avatarUrl || null,
    })
    if (!r.ok) return err(r.error)
    setRoster(r.state)
    await syncNow({ roster: r.state })
    setEditingId(null)
    ok(`${r.value.displayName} updated`)
  }

  return (
    <>
      <PageHeader
        icon={Users}
        kicker="Admin"
        title="Accounts"
        subtitle="One row per email · teacher (Clerk) · learner (invite link)"
        actions={
          <button
            type="button"
            className="primary"
            onClick={() => {
              setShowAdd((v) => !v)
              setDraft(emptyDraft())
            }}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            <span>{showAdd ? 'Cancel' : tab === 'teachers' ? 'Add teacher' : 'Add learner'}</span>
          </button>
        }
      />
      <Flash message={message} error={error} />

      {dupGroups > 0 ? (
        <p className="banner err" role="status">
          {dupGroups} email(s) have duplicate accounts ({hiddenDupes} extra row
          {hiddenDupes === 1 ? '' : 's'} hidden in this list).{' '}
          <button
            type="button"
            className="underline font-semibold"
            onClick={() => {
              const r = mergeDuplicateAccountsByEmail(roster)
              if (!r.ok) return err(r.error)
              setRoster(r.state)
              ok(
                r.value.removed === 0
                  ? 'No duplicates to merge'
                  : `Merged ${r.value.removed} duplicate account(s)`,
              )
            }}
          >
            Merge duplicates
          </button>
        </p>
      ) : null}

      <nav className="subnav accounts-subnav" aria-label="Account type">
        <button
          type="button"
          className={tab === 'teachers' ? 'is-active' : undefined}
          onClick={() => {
            setTab('teachers')
            setShowAdd(false)
            setEditingId(null)
          }}
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          Teachers
          <span className="accounts-tab-count">{teachers.length}</span>
        </button>
        <button
          type="button"
          className={tab === 'learners' ? 'is-active' : undefined}
          onClick={() => {
            setTab('learners')
            setShowAdd(false)
            setEditingId(null)
          }}
        >
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          Learners
          <span className="accounts-tab-count">{learners.length}</span>
        </button>
      </nav>

      {showAdd ? (
        <Panel
          icon={UserPlus}
          title={tab === 'teachers' ? 'New teacher' : 'New learner'}
          description={
            tab === 'teachers'
              ? 'Email must match Clerk staff sign-in. Unique across all accounts.'
              : 'Email is the portal invite identity. Unique across all accounts.'
          }
        >
          <form
            className="accounts-add-form"
            onSubmit={(e) => {
              e.preventDefault()
              createAccount()
            }}
          >
            <label>
              Name
              <input
                value={draft.displayName}
                onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                required
                autoFocus
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                required
                placeholder={tab === 'learners' ? 'learner@school.edu' : 'teacher@school.edu'}
              />
            </label>
            <div className="avatar-field">
              <UserAvatar
                name={draft.displayName || 'User'}
                avatarUrl={draft.avatarUrl}
                size="lg"
              />
              <div className="avatar-field-actions">
                <label className="btn ghost avatar-file-label">
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                  <span>{draft.avatarUrl ? 'Change photo' : 'Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0]
                      ev.target.value = ''
                      if (!file) return
                      try {
                        const url = await readImageAsDataUrl(file)
                        setDraft((d) => ({ ...d, avatarUrl: url }))
                      } catch (error) {
                        err(error instanceof Error ? error.message : 'Could not read image')
                      }
                    }}
                  />
                </label>
                {draft.avatarUrl ? (
                  <button
                    type="button"
                    className="ghost danger"
                    onClick={() => setDraft((d) => ({ ...d, avatarUrl: '' }))}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    <span>Remove</span>
                  </button>
                ) : null}
              </div>
            </div>
            <button type="submit" className="primary">
              <Check className="h-4 w-4" aria-hidden />
              <span>Save</span>
            </button>
          </form>
        </Panel>
      ) : null}

      <Panel
        icon={tab === 'teachers' ? Users : GraduationCap}
        title={tab === 'teachers' ? 'Teachers' : 'Learners'}
        description={
          rows.length === 0
            ? 'No accounts yet'
            : `${rows.length} unique email${rows.length === 1 ? '' : 's'}`
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={tab === 'teachers' ? Users : GraduationCap}
            title={tab === 'teachers' ? 'No teachers' : 'No learners'}
            description="Add an account with a unique email."
            action={
              <button type="button" className="primary" onClick={() => setShowAdd(true)}>
                <UserPlus className="h-4 w-4" aria-hidden />
                <span>Add</span>
              </button>
            }
          />
        ) : (
          <div className="table-wrap accounts-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) =>
                  editingId === u.id ? (
                    <tr key={u.id} className="accounts-row-edit">
                      <td colSpan={3}>
                        <div className="accounts-edit-row">
                          <input
                            className="row-input"
                            value={editDraft.displayName}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, displayName: e.target.value }))
                            }
                            aria-label="Name"
                            placeholder="Name"
                          />
                          <input
                            className="row-input"
                            type="email"
                            value={editDraft.email}
                            onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                            aria-label="Email"
                            placeholder="Email"
                          />
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              name={editDraft.displayName || 'User'}
                              avatarUrl={editDraft.avatarUrl}
                              size="sm"
                            />
                            <label className="btn ghost btn-sm py-1 px-2 cursor-pointer flex items-center gap-1">
                              <ImagePlus className="h-3 w-3" aria-hidden />
                              <span>Upload</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={async (ev) => {
                                  const file = ev.target.files?.[0]
                                  ev.target.value = ''
                                  if (!file) return
                                  try {
                                    const url = await readImageAsDataUrl(file)
                                    setEditDraft((d) => ({ ...d, avatarUrl: url }))
                                  } catch (error) {
                                    err(
                                      error instanceof Error
                                        ? error.message
                                        : 'Could not read image',
                                    )
                                  }
                                }}
                              />
                            </label>
                            {editDraft.avatarUrl ? (
                              <button
                                type="button"
                                className="ghost danger btn-sm p-1"
                                onClick={() => setEditDraft((d) => ({ ...d, avatarUrl: '' }))}
                                title="Remove photo"
                              >
                                <X className="h-3 w-3" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="primary"
                              onClick={() => saveEdit(u.id)}
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              Save
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={u.id}
                      className={
                        (u.accountStatus ?? 'active') === 'inactive'
                          ? 'accounts-row-inactive'
                          : undefined
                      }
                    >
                      <td>
                        <span className="cell-with-avatar">
                          <UserAvatar name={u.displayName} avatarUrl={u.avatarUrl} size="sm" />
                          <span>
                            <strong className="accounts-name">{u.displayName}</strong>
                            <span className="accounts-email">{u.email ?? '—'}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge${(u.accountStatus ?? 'active') === 'active' ? ' success' : ''}`}
                        >
                          {u.accountStatus ?? 'active'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions accounts-actions">
                          {u.email ? (
                            <>
                              <button
                                type="button"
                                className="ghost"
                                title="Copy invite link"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(invitationUrl(u))
                                    ok('Invite copied')
                                  } catch {
                                    ok(invitationUrl(u))
                                  }
                                }}
                              >
                                <Link2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <a
                                className="btn ghost"
                                href={invitationMailto(u)}
                                title="Send invite email"
                              >
                                <Mail className="h-3.5 w-3.5" aria-hidden />
                              </a>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="ghost"
                            title={
                              (u.accountStatus ?? 'active') === 'active' ? 'Deactivate' : 'Activate'
                            }
                            onClick={() => {
                              const next =
                                (u.accountStatus ?? 'active') === 'active' ? 'inactive' : 'active'
                              const r = setAccountStatus(roster, u.id, next)
                              if (!r.ok) return err(r.error)
                              setRoster(r.state)
                              void syncNow({ roster: r.state })
                              ok(`${u.displayName} → ${next}`)
                            }}
                          >
                            <Power className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="ghost"
                            title="Edit"
                            onClick={() => {
                              setEditingId(u.id)
                              setEditDraft({
                                displayName: u.displayName,
                                email: u.email ?? '',
                                avatarUrl: u.avatarUrl ?? '',
                              })
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="ghost danger"
                            title="Delete"
                            onClick={() => {
                              if (!window.confirm(`Delete ${u.displayName}?`)) return
                              const r = deleteUserProfile(roster, u.id)
                              if (!r.ok) return err(r.error)
                              setRoster(r.state)
                              void syncNow({ roster: r.state, pruneMissing: true })
                              ok(`${u.displayName} deleted`)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
