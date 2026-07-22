import { describe, expect, it } from 'vitest'
import {
  assertPackageVersionCanMutate,
  buildSectionQuestionPlan,
  calculateItemCpd,
  createMeasurementOverrideSnapshot,
  createSectionMeasurementSnapshot,
  measuredCvr,
  type CciCategory,
  type TestItem,
  type TestPackageVersion,
  type TestSection,
} from './test-package-catalog'

const draftVersion: TestPackageVersion = {
  id: 'version-draft',
  packageId: 'package-1',
  versionLabel: '1.0.0-draft',
  status: 'draft',
  snapshotHash: null,
  publishedAt: null,
  sourceMetadata: {},
}

const publishedVersion: TestPackageVersion = {
  id: 'version-1',
  packageId: 'package-1',
  versionLabel: '1.0.0',
  status: 'published',
  snapshotHash: 'sha256:abc',
  publishedAt: '2026-07-19T03:00:00.000Z',
  sourceMetadata: {},
}

const section: TestSection = {
  id: 'section-1',
  packageVersionId: 'version-1',
  sectionOrder: 1,
  title: 'Flexible section',
}

function item(id: string, itemOrder: number): TestItem {
  return {
    id,
    sectionId: 'section-1',
    packageVersionId: 'version-1',
    itemOrder,
    promptVi: `Câu ${itemOrder}`,
    promptEn: `Sentence ${itemOrder}`,
    tc: 2,
    lc: itemOrder,
    tl: 3,
    measuredCvr: 2 * itemOrder * 3,
  }
}

const cciCategory: CciCategory = {
  id: 'cci-cat-1',
  profileId: 'cci-profile-1',
  categoryOrder: 1,
  label: 'Current 5',
  value: 5,
  description: null,
  metadata: {},
}

describe('test package catalog', () => {
  it('allows drafts to mutate and rejects published version mutation', () => {
    expect(() => assertPackageVersionCanMutate(draftVersion)).not.toThrow()
    expect(() => assertPackageVersionCanMutate(publishedVersion)).toThrow(
      'Published Package Versions are immutable',
    )
  })

  it('plans flexible section question counts with immutable item refs', () => {
    const items = Array.from({ length: 12 }, (_, index) => item(`item-${index + 1}`, index + 1))
    const plan = buildSectionQuestionPlan({ version: publishedVersion, section, items })

    expect(plan.packageVersionId).toBe('version-1')
    expect(plan.sectionId).toBe('section-1')
    expect(plan.questions).toHaveLength(12)
    expect(plan.questions[0]).toEqual({
      itemId: 'item-1',
      itemOrder: 1,
      externalRef: 'live-test-item:item-1:vversion-1',
    })
    expect(plan.questions[11]?.externalRef).toBe('live-test-item:item-12:vversion-1')
  })

  it('stores item measured CVR as TC × LC × TL without replacing section target CVR', () => {
    expect(measuredCvr({ tc: 2, lc: 3, tl: 4 })).toBe(24)
    expect(measuredCvr({ tc: 2, lc: null, tl: 4 })).toBeNull()
  })

  it('snapshots CCI category values and derives item CPD from section target × CCI', () => {
    const snapshot = createSectionMeasurementSnapshot({
      sectionId: 'section-1',
      packageVersionId: 'version-1',
      targetCvrOhm: 12,
      cciProfileId: 'cci-profile-1',
      cciCategory,
      createdAt: '2026-07-19T03:00:00.000Z',
    })

    expect(snapshot.cciCategoryLabel).toBe('Current 5')
    expect(snapshot.cciValue).toBe(5)
    expect(calculateItemCpd(snapshot)).toBe(60)
  })

  it('creates measurement overrides as new snapshots instead of mutating historical snapshots', () => {
    const original = createSectionMeasurementSnapshot({
      sectionId: 'section-1',
      packageVersionId: 'version-1',
      targetCvrOhm: 12,
      cciProfileId: 'cci-profile-1',
      cciCategory,
      createdAt: '2026-07-19T03:00:00.000Z',
    })
    const override = createMeasurementOverrideSnapshot(original, {
      cciCategory: { ...cciCategory, id: 'cci-cat-2', label: 'Current 6', value: 6 },
      reason: 'Approved measurement review',
      createdAt: '2026-07-19T04:00:00.000Z',
    })

    expect(override.id).not.toBe(original.id)
    expect(override.supersedesSnapshotId).toBe(original.id)
    expect(override.cciCategoryLabel).toBe('Current 6')
    expect(override.cciValue).toBe(6)
    expect(original.cciCategoryLabel).toBe('Current 5')
    expect(calculateItemCpd(original)).toBe(60)
    expect(calculateItemCpd(override)).toBe(72)
  })
})
