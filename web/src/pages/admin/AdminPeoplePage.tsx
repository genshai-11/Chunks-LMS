import { useMemo, useState } from 'react'
import {
  Check,
  GraduationCap,
  ImagePlus,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { readImageAsDataUrl } from '../../lib/readImageFile'
import {
  addLearnerProfile,
  addTeacherProfile,
  deleteUserProfile,
  listLearners,
  listTeachers,
  updateUserProfile,
} from '../../modules/roster/service'
import type { DomainUser } from '../../modules/roster/types'
import { useAppState } from '../../state/useAppState'

type Draft = { displayName: string; email: string; avatarUrl: string | null }

const emptyDraft = (): Draft => ({ displayName: '', email: '', avatarUrl: null })

function AvatarField({
  name,
  avatarUrl,
  onChange,
  onError,
}: {
  name: string
  avatarUrl: string | null
  onChange: (url: string | null) => void
  onError: (msg: string) => void
}) {
  return (
    <div className="avatar-field">
      <UserAvatar name={name || 'Person'} avatarUrl={avatarUrl} size="lg" />
      <div className="avatar-field-actions">
        <label className="btn ghost avatar-file-label">
          <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          <span>{avatarUrl ? 'Change photo' : 'Add photo'}</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                const url = await readImageAsDataUrl(file)
                onChange(url)
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Could not read image')
              }
            }}
          />
        </label>
        {avatarUrl ? (
          <button type="button" className="ghost danger" onClick={() => onChange(null)}>
            <X className="h-3.5 w-3.5" aria-hidden />
            <span>Remove</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}

function PersonEditor({
  users,
  roleLabel,
  icon: Icon,
  createLabel,
  withAvatar,
  onCreate,
  onUpdate,
  onDelete,
  onAvatarError,
}: {
  users: DomainUser[]
  roleLabel: string
  icon: typeof Users
  createLabel: string
  withAvatar?: boolean
  onCreate: (draft: Draft) => void
  onUpdate: (id: string, draft: Draft) => void
  onDelete: (user: DomainUser) => void
  onAvatarError: (msg: string) => void
}) {
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)

  return (
    <Panel
      icon={Icon}
      title={roleLabel}
      description={`${users.length} profile${users.length === 1 ? '' : 's'}`}
    >
      {users.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`No ${roleLabel.toLowerCase()}`}
          description={`Add a ${roleLabel.toLowerCase().slice(0, -1)} profile below.`}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {withAvatar ? <th scope="col">Photo</th> : null}
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) =>
                editingId === u.id ? (
                  <tr key={u.id} className="bg-slate-50/80">
                    {withAvatar ? (
                      <td colSpan={4}>
                        <div className="person-edit-stack">
                          <AvatarField
                            name={editDraft.displayName || u.displayName}
                            avatarUrl={editDraft.avatarUrl}
                            onChange={(url) => setEditDraft((d) => ({ ...d, avatarUrl: url }))}
                            onError={onAvatarError}
                          />
                          <div className="form-grid person-edit-fields">
                            <label>
                              Name
                              <input
                                className="row-input"
                                value={editDraft.displayName}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, displayName: e.target.value }))
                                }
                                aria-label="Name"
                              />
                            </label>
                            <label>
                              Email
                              <input
                                className="row-input"
                                type="email"
                                value={editDraft.email}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, email: e.target.value }))
                                }
                                aria-label="Email"
                              />
                            </label>
                          </div>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="primary"
                              onClick={() => {
                                onUpdate(u.id, editDraft)
                                setEditingId(null)
                              }}
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                              <span>Cancel</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td>
                          <input
                            className="row-input"
                            value={editDraft.displayName}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, displayName: e.target.value }))
                            }
                            aria-label="Name"
                          />
                        </td>
                        <td>
                          <input
                            className="row-input"
                            type="email"
                            value={editDraft.email}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, email: e.target.value }))
                            }
                            aria-label="Email"
                          />
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="primary"
                              onClick={() => {
                                onUpdate(u.id, editDraft)
                                setEditingId(null)
                              }}
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                              <span>Cancel</span>
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ) : (
                  <tr key={u.id}>
                    {withAvatar ? (
                      <td>
                        <UserAvatar name={u.displayName} avatarUrl={u.avatarUrl} size="sm" />
                      </td>
                    ) : null}
                    <td className="font-medium text-slate-800">{u.displayName}</td>
                    <td className="font-mono text-xs text-slate-500">{u.email ?? '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setEditingId(u.id)
                            setEditDraft({
                              displayName: u.displayName,
                              email: u.email ?? '',
                              avatarUrl: u.avatarUrl ?? null,
                            })
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="ghost danger"
                          onClick={() => onDelete(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          <span>Delete</span>
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

      <div className="panel-footer-form">
        <p className="panel-title mb-3">{createLabel}</p>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            onCreate(createDraft)
            setCreateDraft(emptyDraft())
          }}
        >
          {withAvatar ? (
            <div className="form-span-full">
              <AvatarField
                name={createDraft.displayName}
                avatarUrl={createDraft.avatarUrl}
                onChange={(url) => setCreateDraft((d) => ({ ...d, avatarUrl: url }))}
                onError={onAvatarError}
              />
            </div>
          ) : null}
          <label>
            Name
            <input
              value={createDraft.displayName}
              onChange={(e) => setCreateDraft((d) => ({ ...d, displayName: e.target.value }))}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={createDraft.email}
              onChange={(e) => setCreateDraft((d) => ({ ...d, email: e.target.value }))}
              placeholder="optional"
            />
          </label>
          <button type="submit" className="primary">
            <UserPlus className="h-4 w-4" aria-hidden />
            <span>{createLabel}</span>
          </button>
        </form>
      </div>
    </Panel>
  )
}

export function AdminPeoplePage() {
  const { roster, setRoster } = useAppState()
  const { message, error, ok, err } = useFlash()
  const teachers = useMemo(() => listTeachers(roster), [roster])
  const learners = useMemo(() => listLearners(roster), [roster])

  return (
    <>
      <PageHeader
        icon={Users}
        kicker="Admin"
        title="People"
        subtitle="Create, edit, or delete teacher and learner profiles. Learners can have a photo."
      />
      <Flash message={message} error={error} />

      <div className="split">
        <PersonEditor
          users={teachers}
          roleLabel="Teachers"
          icon={Users}
          createLabel="Add teacher"
          onAvatarError={err}
          onCreate={(draft) => {
            const r = addTeacherProfile(roster, {
              displayName: draft.displayName,
              email: draft.email || null,
            })
            if (!r.ok) return err(r.error)
            setRoster(r.state)
            ok(`Teacher ${r.value.displayName} added`)
          }}
          onUpdate={(id, draft) => {
            const r = updateUserProfile(roster, id, {
              displayName: draft.displayName,
              email: draft.email || null,
            })
            if (!r.ok) return err(r.error)
            setRoster(r.state)
            ok(`${r.value.displayName} updated`)
          }}
          onDelete={(user) => {
            if (!window.confirm(`Delete ${user.displayName}?`)) return
            const r = deleteUserProfile(roster, user.id)
            if (!r.ok) return err(r.error)
            setRoster(r.state)
            ok(`${user.displayName} deleted`)
          }}
        />

        <PersonEditor
          users={learners}
          roleLabel="Learners"
          icon={GraduationCap}
          createLabel="Add learner"
          withAvatar
          onAvatarError={err}
          onCreate={(draft) => {
            const r = addLearnerProfile(roster, {
              displayName: draft.displayName,
              email: draft.email || null,
              avatarUrl: draft.avatarUrl,
            })
            if (!r.ok) return err(r.error)
            setRoster(r.state)
            ok(`Learner ${r.value.displayName} added`)
          }}
          onUpdate={(id, draft) => {
            const r = updateUserProfile(roster, id, {
              displayName: draft.displayName,
              email: draft.email || null,
              avatarUrl: draft.avatarUrl,
            })
            if (!r.ok) return err(r.error)
            setRoster(r.state)
            ok(`${r.value.displayName} updated`)
          }}
          onDelete={(user) => {
            if (!window.confirm(`Delete ${user.displayName}?`)) return
            const r = deleteUserProfile(roster, user.id)
            if (!r.ok) return err(r.error)
            setRoster(r.state)
            ok(`${user.displayName} deleted`)
          }}
        />
      </div>
    </>
  )
}
