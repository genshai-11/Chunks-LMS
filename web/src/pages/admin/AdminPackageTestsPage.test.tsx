import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AdminPackageTestsPage, detectPackageTestType } from './AdminPackageTestsPage'
import * as testPackagesLib from '../../lib/test-packages'
import * as liveTestGenLib from '../../modules/catalog/live-test-generation'

describe('AdminPackageTestsPage', () => {
  it('renders package studio page header, tabs, and create button', async () => {
    vi.spyOn(testPackagesLib, 'listTestPackages').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'pkg-1',
          organizationId: 'org-1',
          title: 'RED-TEST-42Q-TOPIC12-56V · LIVE',
          slug: 'red-test-42q-topic12-56v',
          description: 'Red test package description',
          createdByUserId: null,
          sourceMetadata: { testType: 'red', targetVoltage: 56, questionCount: 42 },
          archivedAt: null,
        },
        {
          id: 'pkg-2',
          organizationId: 'org-1',
          title: 'GREEN-TEST-21Q-FOCUS-12V',
          slug: 'green-test-21q-focus-12v',
          description: 'Green test package description',
          createdByUserId: null,
          sourceMetadata: { testType: 'green', targetVoltage: 12, questionCount: 21 },
          archivedAt: null,
        },
      ],
    })

    vi.spyOn(testPackagesLib, 'listTestPackageVersions').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'ver-1',
          packageId: 'pkg-1',
          versionLabel: 'v1',
          status: 'published',
          snapshotHash: null,
          publishedAt: null,
          sourceMetadata: {},
        },
      ],
    })

    vi.spyOn(testPackagesLib, 'listTestSections').mockResolvedValue({
      ok: true,
      data: [],
    })

    vi.spyOn(liveTestGenLib, 'listFirestoreLessons').mockResolvedValue([
      { id: 'l1', lessonTitle: 'Day 1 Lesson', levelCode: 'A', dayNumber: 1, totalChunks: 40 },
    ])

    render(
      <MemoryRouter>
        <AdminPackageTestsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /Package Tests Studio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create Package Test/i })).toBeInTheDocument()

    // Verify packages are rendered and trailing · LIVE is stripped from title
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /RED-TEST-42Q-TOPIC12-56V/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /RED-TEST-42Q-TOPIC12-56V · LIVE/i })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /GREEN-TEST-21Q-FOCUS-12V/i })).toBeInTheDocument()
    })

    // Filter tabs
    expect(screen.getByRole('button', { name: /Green Tests/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Red Tests/i })).toBeInTheDocument()
  })

  it('opens Create Package Test modal when clicking Create Package Test button', async () => {
    const user = userEvent.setup()

    vi.spyOn(testPackagesLib, 'listTestPackages').mockResolvedValue({
      ok: true,
      data: [],
    })
    vi.spyOn(liveTestGenLib, 'listFirestoreLessons').mockResolvedValue([
      { id: 'l1', lessonTitle: 'Day 1 Lesson', levelCode: 'A', dayNumber: 1, totalChunks: 40 },
    ])

    render(
      <MemoryRouter>
        <AdminPackageTestsPage />
      </MemoryRouter>,
    )

    const createBtn = screen.getByRole('button', { name: /Create Package Test/i })
    await user.click(createBtn)

    expect(screen.getByRole('heading', { name: /Create Test Package/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AI Generator \(Firestore Vocab\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manual Blank Draft/i })).toBeInTheDocument()
    expect(screen.getByText(/Dynamic Test Type/i)).toBeInTheDocument()
  })

  it('detectPackageTestType correctly identifies R4-31V-0826 and red/green packages', () => {
    // Exact user reported case: R4-31V-0826 without explicit metadata must be classified as RED
    expect(detectPackageTestType({ title: 'R4-31V-0826', slug: 'r4-31v-0826' })).toBe('red')
    expect(detectPackageTestType({ title: 'R01-42Q-56V', slug: 'r01-42q-56v' })).toBe('red')
    expect(detectPackageTestType({ title: 'RED-TEST-AWARENESS', slug: 'red-test-01' })).toBe('red')

    // Green tests
    expect(detectPackageTestType({ title: 'G01-21Q-12V', slug: 'g01-21q-12v' })).toBe('green')
    expect(detectPackageTestType({ title: 'GREEN-TEST-FOCUS', slug: 'green-test-01' })).toBe('green')
    expect(detectPackageTestType({ title: 'General Practice Test', slug: 'general-practice' })).toBe('green')
  })
})
