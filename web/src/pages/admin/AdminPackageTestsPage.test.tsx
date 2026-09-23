import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AdminPackageTestsPage, detectPackageTestType } from './AdminPackageTestsPage'
import * as testPackagesLib from '../../lib/test-packages'
import * as liveTestGenLib from '../../modules/catalog/live-test-generation'

describe('AdminPackageTestsPage', { timeout: 20000 }, () => {
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

  it('switches between Studio tabs (Gói bài test, Soạn thảo, Audio, CCI)', async () => {
    const user = userEvent.setup()

    vi.spyOn(testPackagesLib, 'listTestPackages').mockResolvedValue({
      ok: true,
      data: [],
    })
    vi.spyOn(testPackagesLib, 'listCciProfiles').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'prof-1',
          organizationId: 'org-1',
          name: 'Ecommerce 7-Session Ample',
          versionLabel: 'v1',
          status: 'active',
          description: 'Ample curve for eCommerce',
        },
      ],
    })
    vi.spyOn(testPackagesLib, 'listCciCategories').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'cat-1',
          profileId: 'prof-1',
          categoryOrder: 1,
          label: 'Session 1 Ample',
          value: 6.0,
          description: null,
          metadata: {},
        },
      ],
    })

    render(
      <MemoryRouter>
        <AdminPackageTestsPage />
      </MemoryRouter>,
    )

    // Switch to Soạn thảo & Nội dung câu
    const contentTab = screen.getByRole('button', { name: /Soạn thảo & Nội dung câu/i })
    await user.click(contentTab)
    expect(screen.getByText(/Vui lòng chọn một gói bài test từ danh mục/i)).toBeInTheDocument()

    // Switch to Quản lý Audio & Review
    const audioTab = screen.getByRole('button', { name: /Quản lý Audio & Review/i })
    await user.click(audioTab)
    expect(screen.getByText(/Vui lòng chọn một gói bài test từ danh mục để quản lý âm thanh/i)).toBeInTheDocument()

    // Switch to Hệ số CCI & Ample CRUD
    const cciTab = screen.getByRole('button', { name: /Hệ số CCI & Ample CRUD/i })
    await user.click(cciTab)
    expect(screen.getByRole('heading', { name: /Quản lý Hệ Số CCI & Cường Độ Ample/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+ Hồ sơ mới/i })).toBeInTheDocument()
  })

  it('displays CVR formula and Ample inputs in active AI generator modal', async () => {
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

    // Verify CVR controls are present
    expect(screen.getByText(/Tham số CVR = TC × TL × LC/i)).toBeInTheDocument()
    expect(screen.getByText(/TC \(Term\)/i)).toBeInTheDocument()
    expect(screen.getByText(/TL \(Topic Level\)/i)).toBeInTheDocument()
    expect(screen.getByText(/LC \(Length\)/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Số Session/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Số câu \/ session/i)).toBeInTheDocument()
    expect(screen.getByText(/Target CPD \(Volt\)/i)).toBeInTheDocument()
  })

  it('renders Green validation badges when inspecting package content', async () => {
    const user = userEvent.setup()

    vi.spyOn(testPackagesLib, 'listTestPackages').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'pkg-green',
          organizationId: 'org-1',
          title: 'GREEN-TEST-FOCUS-12V',
          slug: 'green-test-focus-12v',
          description: null,
          createdByUserId: null,
          sourceMetadata: { testType: 'green', targetVoltage: 12 },
          archivedAt: null,
        },
      ],
    })

    vi.spyOn(testPackagesLib, 'listTestPackageVersions').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'ver-green',
          packageId: 'pkg-green',
          versionLabel: 'v1',
          status: 'draft',
          snapshotHash: null,
          publishedAt: null,
          sourceMetadata: {},
        },
      ],
    })

    vi.spyOn(testPackagesLib, 'listTestSections').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'sec-1',
          packageVersionId: 'ver-green',
          sectionOrder: 1,
          title: 'Focus Sprint 1',
          targetCvrOhm: 3.0,
          introTextVi: 'Phần 1',
          introTextEn: 'Part 1',
          cciProfileId: 'prof-1',
          cciCategoryId: 'cat-1',
        },
      ],
    })

    vi.spyOn(testPackagesLib, 'listTestItems').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'item-1',
          packageVersionId: 'ver-green',
          sectionId: 'sec-1',
          itemOrder: 1,
          termVi: 'quy trình thanh toán',
          termEn: 'payment process',
          promptVi: 'Khách hàng hoàn tất quy trình thanh toán trực tuyến nhanh chóng và thuận tiện.',
          promptEn: 'Customers complete the online payment process quickly and conveniently.',
          spokenScriptVi: 'Khách hàng hoàn tất quy trình thanh toán trực tuyến nhanh chóng và thuận tiện.',
          spokenScriptEn: 'Customers complete the online payment process quickly and conveniently.',
          tc: 3.0,
          lc: 1.0,
          tl: 1.0,
          measuredCvr: 3.0,
        },
      ],
    })

    render(
      <MemoryRouter>
        <AdminPackageTestsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /GREEN-TEST-FOCUS-12V/i })).toBeInTheDocument()
    })

    const contentBtn = screen.getByRole('button', { name: /Soạn nội dung/i })
    await user.click(contentBtn)

    await waitFor(() => {
      expect(screen.getByText(/Focus Sprint 1/i)).toBeInTheDocument()
      expect(screen.getAllByText(/quy trình thanh toán/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/15 từ \(Giới hạn: 8–22 từ\)/i)).toBeInTheDocument()
    })
  })

  it('renders complete lifecycle audio cards including part_intro and session_intro in Audio tab', async () => {
    const user = userEvent.setup()

    vi.spyOn(testPackagesLib, 'listTestPackages').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'pkg-audio',
          organizationId: 'org-1',
          title: 'RED-TEST-42Q-56V',
          slug: 'red-test-42q-56v',
          description: null,
          createdByUserId: null,
          sourceMetadata: { testType: 'red', targetVoltage: 56 },
          archivedAt: null,
        },
      ],
    })

    vi.spyOn(testPackagesLib, 'listTestPackageVersions').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'ver-audio',
          packageId: 'pkg-audio',
          versionLabel: 'v1',
          status: 'draft',
          snapshotHash: null,
          publishedAt: null,
          sourceMetadata: {},
        },
      ],
    })

    vi.spyOn(testPackagesLib, 'listTestSections').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'sec-audio-1',
          packageVersionId: 'ver-audio',
          sectionOrder: 1,
          title: 'Awareness Trap 1',
          targetCvrOhm: 6.9,
          introTextVi: 'Phiên 1 - Bắt đầu',
          introTextEn: 'Session 1 - Start',
          cciProfileId: 'prof-1',
          cciCategoryId: 'cat-1',
        },
      ],
    })

    vi.spyOn(testPackagesLib, 'listTestItems').mockResolvedValue({
      ok: true,
      data: [],
    })

    render(
      <MemoryRouter>
        <AdminPackageTestsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /RED-TEST-42Q-56V/i })).toBeInTheDocument()
    })

    const audioBtn = screen.getByRole('button', { name: /^Audio$/i })
    await user.click(audioBtn)

    await waitFor(() => {
      expect(screen.getByText(/Lời Chào Đầu Bài \(Package Start\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Lời Chúc Mừng Kết Thúc \(Package End\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Giới thiệu từng phần \(Part Intros · P1 - P3\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Part 1 Intro/i)).toBeInTheDocument()
      expect(screen.getByText(/Giới thiệu từng phiên \(Session Intros/i)).toBeInTheDocument()
      expect(screen.getByText(/Session 1: Awareness Trap 1/i)).toBeInTheDocument()
    })
  })
})

