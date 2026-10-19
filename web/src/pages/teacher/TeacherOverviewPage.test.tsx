import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TeacherOverviewPage } from './TeacherOverviewPage'
import { createSeedRoster } from '../../modules/roster/seed'
import { emptySchedulingState } from '../../modules/scheduling/session-lifecycle'
import { createDefaultMetricSettings } from '../../modules/metrics/settings'
import type { AppStateContextValue } from '../../state/app-state-context'
import { AppStateContext } from '../../state/app-state-context'
import type { StaffSession } from '../../auth/StaffSessionContext'
import { BypassStaffSessionProvider, StaffSessionContext } from '../../auth/StaffSessionContext'
function renderWithContext(initialRoster = createSeedRoster()) {
  const syncNowMock = vi.fn().mockResolvedValue({ ok: true })
  let currentRoster = {
    ...initialRoster,
    classes: initialRoster.classes.map((c) => ({ ...c, capacity: 10 })),
  }
  const setRosterMock = vi.fn((next) => {
    currentRoster = typeof next === 'function' ? next(currentRoster) : next
  })
  const setActiveLearnerUserIdMock = vi.fn()
  const setActiveClassIdMock = vi.fn()

  const mockClass = currentRoster.classes[0]!

  const mockContextValue: any = {
    roster: currentRoster,
    setRoster: setRosterMock,
    scheduling: emptySchedulingState(),
    setScheduling: vi.fn(),
    capture: null,
    setCapture: vi.fn(),
    ledger: [],
    setLedger: vi.fn(),
    opsAuditEvents: [],
    metricSettings: createDefaultMetricSettings(),
    setMetricSettings: vi.fn(),
    activeLearnerUserId: null,
    setActiveLearnerUserId: setActiveLearnerUserIdMock,
    activeClassId: mockClass.id,
    setActiveClassId: setActiveClassIdMock,
    syncNow: syncNowMock,
    backendStatus: 'ready',
    syncError: null,
    dismissSyncError: vi.fn(),
  }

  const result = render(
    <BypassStaffSessionProvider>
      <AppStateContext.Provider value={mockContextValue}>
        <MemoryRouter>
          <TeacherOverviewPage />
        </MemoryRouter>
      </AppStateContext.Provider>
    </BypassStaffSessionProvider>,
  )

  return {
    ...result,
    currentRoster,
    setRosterMock,
    syncNowMock,
    setActiveLearnerUserIdMock,
    setActiveClassIdMock,
  }
}

describe('TeacherOverviewPage - Add Learner', () => {
  it('renders Add learner button in header actions', () => {
    renderWithContext()
    const addBtn = screen.getByRole('button', { name: /Add learner/i })
    expect(addBtn).toBeInTheDocument()
  }, 15000)

  it('opens New Learner panel when Add learner button is clicked', async () => {
    const user = userEvent.setup()
    renderWithContext()

    const addBtn = screen.getByRole('button', { name: /Add learner/i })
    await user.click(addBtn)

    expect(screen.getByRole('heading', { name: /New learner/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email \(optional\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Class enrollment/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save Learner/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
  }, 15000)

  it('creates learner and triggers syncNow when submitting form', async () => {
    const user = userEvent.setup()
    const { setRosterMock, syncNowMock } = renderWithContext()

    await user.click(screen.getByRole('button', { name: /Add learner/i }))

    const nameInput = screen.getByLabelText(/Display Name/i)
    const emailInput = screen.getByLabelText(/Email \(optional\)/i)

    await user.type(nameInput, 'Alex Morgan')
    await user.type(emailInput, 'alex.morgan@chunks.edu')

    await user.click(screen.getByRole('button', { name: /Save Learner/i }))

    await waitFor(() => {
      expect(setRosterMock).toHaveBeenCalled()
      expect(syncNowMock).toHaveBeenCalled()
    })
  }, 15000)

  it('closes New Learner panel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderWithContext()

    await user.click(screen.getByRole('button', { name: /Add learner/i }))
    expect(screen.getByRole('heading', { name: /New learner/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(screen.queryByRole('heading', { name: /New learner/i })).not.toBeInTheDocument()
  }, 15000)

  it('creates unassigned learner when no class is selected', async () => {
    const user = userEvent.setup()
    const { setRosterMock, syncNowMock } = renderWithContext()

    await user.click(screen.getByRole('button', { name: /Add learner/i }))

    const nameInput = screen.getByLabelText(/Display Name/i)
    const classSelect = screen.getByLabelText(/Class enrollment/i)

    await user.type(nameInput, 'Taylor Swift')
    await user.selectOptions(classSelect, '')

    await user.click(screen.getByRole('button', { name: /Save Learner/i }))

    await waitFor(() => {
      expect(setRosterMock).toHaveBeenCalled()
      expect(syncNowMock).toHaveBeenCalled()
    })
  }, 15000)

  it('disables save when no class is selected for teacher-only session', async () => {
    const user = userEvent.setup()
    const initialRoster = createSeedRoster()
    const seededTeacher = initialRoster.users.find((u) => u.roles.includes('teacher'))!
    const teacherSession = {
      ready: true,
      signedIn: true,
      authBypass: false,
      authEnabled: true,
      userId: 'teacher-auth-1',
      domainUserId: seededTeacher.id,
      email: seededTeacher.email,
      displayName: seededTeacher.displayName,
      staffRoles: ['teacher' as const],
      canAccess: (role: string) => role === 'teacher',
      isStaff: true,
      signInWithEmail: vi.fn(),
      signInWithPassword: vi.fn(),
      signUpWithPassword: vi.fn(),
      signOut: vi.fn(),
    } as unknown as StaffSession
    const mockContextValue = {
      roster: initialRoster,
      setRoster: vi.fn(),
      scheduling: emptySchedulingState(),
      setScheduling: vi.fn(),
      capture: null,
      setCapture: vi.fn(),
      ledger: [],
      setLedger: vi.fn(),
      opsAuditEvents: [],
      metricSettings: createDefaultMetricSettings(),
      setMetricSettings: vi.fn(),
      activeLearnerUserId: null,
      setActiveLearnerUserId: vi.fn(),
      activeClassId: null,
      setActiveClassId: vi.fn(),
      syncNow: vi.fn(),
      backendStatus: 'ready' as const,
      syncError: null,
      dismissSyncError: vi.fn(),
    } as unknown as AppStateContextValue

    render(
      <StaffSessionContext.Provider value={teacherSession}>
        <AppStateContext.Provider value={mockContextValue}>
          <MemoryRouter>
            <TeacherOverviewPage />
          </MemoryRouter>
        </AppStateContext.Provider>
      </StaffSessionContext.Provider>,
    )

    await user.click(screen.getByRole('button', { name: /Add learner/i }))
    const nameInput = screen.getByLabelText(/Display Name/i)
    await user.type(nameInput, 'Taylor Swift')

    const classSelect = screen.getByLabelText(/Class enrollment/i)
    await user.selectOptions(classSelect, '')

    const saveBtn = screen.getByRole('button', { name: /Save Learner/i })
    expect(saveBtn).toBeDisabled()
  }, 15000)
})
