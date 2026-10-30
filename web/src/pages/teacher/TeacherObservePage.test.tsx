import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeacherObservePage } from './TeacherObservePage'
import { createSeedRoster } from '../../modules/roster/seed'
import { createDefaultMetricSettings } from '../../modules/metrics/settings'
import type { AppStateContextValue } from '../../state/app-state-context'
import { AppStateContext } from '../../state/app-state-context'
import { BypassStaffSessionProvider } from '../../auth/StaffSessionContext'
import type { CaptureSessionState } from '../../modules/assessment/session-capture'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockRecordLiveColor = vi.fn()
const mockSyncCaptureSessionToServer = vi.fn()
vi.mock('../../lib/live-assessment', async () => {
  const actual = await vi.importActual('../../lib/live-assessment')
  return {
    ...actual,
    recordLiveColor: (...args: unknown[]) => mockRecordLiveColor(...args),
    syncCaptureSessionToServer: (...args: unknown[]) => mockSyncCaptureSessionToServer(...args),
    loadLiveCapture: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        learningSessionId: 'sess-1',
        teacherUserId: 'teacher-1',
        learnerIds: ['learner-1'],
        sessionStatus: 'open',
        questions: [{ id: 'q-1', learningSessionId: 'sess-1', sequenceNumber: 1, externalRef: null, assignedLearnerUserId: 'learner-1' }],
        attempts: [{ id: 'att-1', learningSessionId: 'sess-1', sessionQuestionId: 'q-1', learnerUserId: 'learner-1', teacherUserId: 'teacher-1', snapshot: { status: 'finalized', provisionalColor: 'green', effectiveColor: 'green', effectiveScore: 2, probeCount: 0, maxProbeCount: 2, enteredProbeFlow: false, finalizedAt: '2026-10-20' } }],
        position: { mode: 'question_first', questionIndex: 0, learnerIndex: 0 },
        maxProbeCount: 2,
      },
    }),
  }
})
describe('TeacherObservePage - Finish and Failure Handling', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })
  it('shows error warning and retains modal when server sync fails during finish', async () => {
    mockSyncCaptureSessionToServer.mockResolvedValueOnce({
      ok: false,
      error: 'Network timeout writing snapshots',
    })

    const user = userEvent.setup()
    const initialRoster = createSeedRoster()
    const classId = initialRoster.classes[0]!.id
    const teacherId = initialRoster.classes[0]!.teacherUserId
    const learnerId = initialRoster.enrollments.find((e) => e.classId === classId)!.learnerUserId

    const openSession = {
      id: 'sess-1',
      classId,
      scheduledSessionId: null,
      status: 'open' as const,
      plannedQuestionCount: null,
      startedAt: '2026-10-20T10:00:00.000Z',
      completedAt: null,
      maxProbeCount: 2,
      sessionNumber: 1,
      ownerUserId: teacherId,
      lockExpiresAt: null,
      sessionKind: 'regular' as const,
      sessionFormat: 'lesson' as const,
      promptLanguage: null,
      liveTestResourceId: null,
      liveTestBlockId: null,
      participantLearnerIds: [learnerId],
    }

    const captureState: CaptureSessionState = {
      learningSessionId: 'sess-1',
      teacherUserId: teacherId,
      learnerIds: [learnerId],
      sessionStatus: 'open',
      questions: [
        {
          id: 'q-1',
          learningSessionId: 'sess-1',
          sequenceNumber: 1,
          externalRef: null,
          assignedLearnerUserId: learnerId,
        },
      ],
      attempts: [
        {
          id: 'att-1',
          learningSessionId: 'sess-1',
          sessionQuestionId: 'q-1',
          learnerUserId: learnerId,
          teacherUserId: teacherId,
          snapshot: {
            status: 'finalized',
            provisionalColor: 'green',
            effectiveColor: 'green',
            effectiveScore: 2,
            probeCount: 0,
            maxProbeCount: 2,
            enteredProbeFlow: false,
            finalizedAt: '2026-10-20T10:05:00.000Z',
          },
        },
      ],
      position: { mode: 'question_first', questionIndex: 0, learnerIndex: 0 },
      maxProbeCount: 2,
    }

    const mockContextValue = {
      roster: initialRoster,
      setRoster: vi.fn(),
      scheduling: {
        scheduledSessions: [],
        learningSessions: [openSession],
        attendance: [],
      },
      setScheduling: vi.fn(),
      capture: captureState,
      setCapture: vi.fn(),
      ledger: [],
      setLedger: vi.fn(),
      opsAuditEvents: [],
      metricSettings: createDefaultMetricSettings(),
      setMetricSettings: vi.fn(),
      activeLearnerUserId: learnerId,
      setActiveLearnerUserId: vi.fn(),
      activeClassId: classId,
      setActiveClassId: vi.fn(),
      syncNow: vi.fn().mockResolvedValue(true),
      appendFinalizedFromCapture: vi.fn(),
      backendStatus: 'ready' as const,
      syncError: null,
      dismissSyncError: vi.fn(),
    } as unknown as AppStateContextValue

    render(
      <BypassStaffSessionProvider>
        <AppStateContext.Provider value={mockContextValue}>
          <MemoryRouter>
            <TeacherObservePage />
          </MemoryRouter>
        </AppStateContext.Provider>
      </BypassStaffSessionProvider>,
    )

    // Click Finish FAB button to open summary modal
    const finishBtn = screen.getByRole('button', { name: /Finish session and save/i })
    await user.click(finishBtn)

    // Summary modal should be open
    expect(screen.getByRole('heading', { name: /Session Summary/i })).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: /Save & Finish/i })
    expect(confirmBtn).toBeInTheDocument()

    // Confirm finish
    await user.click(confirmBtn)

    // Should call syncCaptureSessionToServer
    await waitFor(() => {
      expect(mockSyncCaptureSessionToServer).toHaveBeenCalled()
    })

    // Because sync failed, it should flash warning and stay on screen rather than navigating away
    await waitFor(() => {
      expect(screen.getByText(/Cảnh báo: Không thể lưu kết quả lên server/i)).toBeInTheDocument()
    })
  })

  it('successfully completes session, syncs to server, appends to ledger, and navigates to analysis', async () => {
    mockSyncCaptureSessionToServer.mockResolvedValueOnce({
      ok: true,
      data: true,
    })

    const user = userEvent.setup()
    const initialRoster = createSeedRoster()
    const classId = initialRoster.classes[0]!.id
    const teacherId = initialRoster.classes[0]!.teacherUserId
    const learnerId = initialRoster.enrollments.find((e) => e.classId === classId)!.learnerUserId

    const openSession = {
      id: 'sess-1',
      classId,
      scheduledSessionId: null,
      status: 'open' as const,
      plannedQuestionCount: null,
      startedAt: '2026-10-20T10:00:00.000Z',
      completedAt: null,
      maxProbeCount: 2,
      sessionNumber: 1,
      ownerUserId: teacherId,
      lockExpiresAt: null,
      sessionKind: 'regular' as const,
      sessionFormat: 'lesson' as const,
      promptLanguage: null,
      liveTestResourceId: null,
      liveTestBlockId: null,
      participantLearnerIds: [learnerId],
    }

    const captureState: CaptureSessionState = {
      learningSessionId: 'sess-1',
      teacherUserId: teacherId,
      learnerIds: [learnerId],
      sessionStatus: 'open',
      questions: [
        {
          id: 'q-1',
          learningSessionId: 'sess-1',
          sequenceNumber: 1,
          externalRef: null,
          assignedLearnerUserId: learnerId,
        },
      ],
      attempts: [
        {
          id: 'att-1',
          learningSessionId: 'sess-1',
          sessionQuestionId: 'q-1',
          learnerUserId: learnerId,
          teacherUserId: teacherId,
          snapshot: {
            status: 'finalized',
            provisionalColor: 'green',
            effectiveColor: 'green',
            effectiveScore: 2,
            probeCount: 0,
            maxProbeCount: 2,
            enteredProbeFlow: false,
            finalizedAt: '2026-10-20T10:05:00.000Z',
          },
        },
      ],
      position: { mode: 'question_first', questionIndex: 0, learnerIndex: 0 },
      maxProbeCount: 2,
    }

    const mockSetScheduling = vi.fn()
    const mockSetCapture = vi.fn()
    const mockAppendFinalized = vi.fn()
    const mockSyncNow = vi.fn().mockResolvedValue(true)

    const mockContextValue = {
      roster: initialRoster,
      setRoster: vi.fn(),
      scheduling: {
        scheduledSessions: [],
        learningSessions: [openSession],
        attendance: [],
      },
      setScheduling: mockSetScheduling,
      capture: captureState,
      setCapture: mockSetCapture,
      ledger: [],
      setLedger: vi.fn(),
      opsAuditEvents: [],
      metricSettings: createDefaultMetricSettings(),
      setMetricSettings: vi.fn(),
      activeLearnerUserId: learnerId,
      setActiveLearnerUserId: vi.fn(),
      activeClassId: classId,
      setActiveClassId: vi.fn(),
      syncNow: mockSyncNow,
      appendFinalizedFromCapture: mockAppendFinalized,
      backendStatus: 'ready' as const,
      syncError: null,
      dismissSyncError: vi.fn(),
    } as unknown as AppStateContextValue

    render(
      <BypassStaffSessionProvider>
        <AppStateContext.Provider value={mockContextValue}>
          <MemoryRouter>
            <TeacherObservePage />
          </MemoryRouter>
        </AppStateContext.Provider>
      </BypassStaffSessionProvider>,
    )

    const finishBtn = screen.getByRole('button', { name: /Finish session and save/i })
    await user.click(finishBtn)

    const confirmBtn = screen.getByRole('button', { name: /Save & Finish/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(mockSyncCaptureSessionToServer).toHaveBeenCalled()
      expect(mockSyncNow).toHaveBeenCalled()
      expect(mockSetScheduling).toHaveBeenCalled()
      expect(mockAppendFinalized).toHaveBeenCalledWith(
        expect.objectContaining({ sessionStatus: 'completed' }),
      )
    })

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith(
          `/teacher/analysis?learner=${encodeURIComponent(learnerId)}&session=sess-1`,
        )
      },
      { timeout: 3000 },
    )
  })

  it('drops concurrent scoring clicks while liveSaving is in flight', async () => {
    const { promise, resolve } = Promise.withResolvers<unknown>()
    mockRecordLiveColor.mockReturnValueOnce(promise)

    const initialRoster = createSeedRoster()
    const classId = initialRoster.classes[0]!.id
    const teacherId = initialRoster.classes[0]!.teacherUserId
    const learnerId = initialRoster.enrollments.find((e) => e.classId === classId)!.learnerUserId

    const openSession = {
      id: 'sess-1',
      classId,
      scheduledSessionId: null,
      status: 'open' as const,
      plannedQuestionCount: null,
      startedAt: '2026-10-20T10:00:00.000Z',
      completedAt: null,
      maxProbeCount: 2,
      sessionNumber: 1,
      ownerUserId: teacherId,
      lockExpiresAt: null,
      sessionKind: 'regular' as const,
      sessionFormat: 'lesson' as const,
      promptLanguage: null,
      liveTestResourceId: null,
      liveTestBlockId: null,
      participantLearnerIds: [learnerId],
    }

    const captureState: CaptureSessionState = {
      learningSessionId: 'sess-1',
      teacherUserId: teacherId,
      learnerIds: [learnerId],
      sessionStatus: 'open',
      questions: [
        {
          id: 'q-1',
          learningSessionId: 'sess-1',
          sequenceNumber: 1,
          externalRef: null,
          assignedLearnerUserId: learnerId,
        },
      ],
      attempts: [
        {
          id: 'att-1',
          learningSessionId: 'sess-1',
          sessionQuestionId: 'q-1',
          learnerUserId: learnerId,
          teacherUserId: teacherId,
          snapshot: {
            status: 'draft',
            provisionalColor: null,
            effectiveColor: null,
            effectiveScore: null,
            probeCount: 0,
            maxProbeCount: 2,
            enteredProbeFlow: false,
            finalizedAt: null,
          },
        },
      ],
      position: { mode: 'question_first', questionIndex: 0, learnerIndex: 0 },
      maxProbeCount: 2,
    }

    const mockContextValue = {
      roster: initialRoster,
      setRoster: vi.fn(),
      scheduling: {
        scheduledSessions: [],
        learningSessions: [openSession],
        attendance: [],
      },
      setScheduling: vi.fn(),
      capture: captureState,
      setCapture: vi.fn(),
      ledger: [],
      setLedger: vi.fn(),
      opsAuditEvents: [],
      metricSettings: createDefaultMetricSettings(),
      setMetricSettings: vi.fn(),
      activeLearnerUserId: learnerId,
      setActiveLearnerUserId: vi.fn(),
      activeClassId: classId,
      setActiveClassId: vi.fn(),
      syncNow: vi.fn().mockResolvedValue(true),
      appendFinalizedFromCapture: vi.fn(),
      backendStatus: 'ready' as const,
      syncError: null,
      dismissSyncError: vi.fn(),
    } as unknown as AppStateContextValue

    render(
      <BypassStaffSessionProvider>
        <AppStateContext.Provider value={mockContextValue}>
          <MemoryRouter>
            <TeacherObservePage />
          </MemoryRouter>
        </AppStateContext.Provider>
      </BypassStaffSessionProvider>,
    )

    const greenBtn = screen.getByRole('button', { name: /^Green$/i })
    fireEvent.click(greenBtn)
    fireEvent.click(greenBtn)

    expect(mockRecordLiveColor).toHaveBeenCalledTimes(1)

    resolve({
      ok: true,
      data: {
        ...captureState.attempts[0]!,
        snapshot: {
          ...captureState.attempts[0]!.snapshot,
          status: 'finalized',
          effectiveColor: 'green',
        },
      },
    })
  })
})
