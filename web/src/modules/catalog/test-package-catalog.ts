import { liveTestExternalRef } from '../assessment/live-test'

export type TestPackageVersionStatus = 'draft' | 'published' | 'archived'

export type TestPackage = {
  id: string
  organizationId: string
  title: string
  slug: string
  createdByUserId: string | null
  archivedAt: string | null
}

export type TestPackageVersion = {
  id: string
  packageId: string
  versionLabel: string
  status: TestPackageVersionStatus
  snapshotHash: string | null
  publishedAt: string | null
}

export type TestSection = {
  id: string
  packageVersionId: string
  sectionOrder: number
  title: string | null
}

export type TestItem = {
  id: string
  sectionId: string
  packageVersionId: string
  itemOrder: number
  promptVi: string | null
  promptEn: string | null
  tc: number | null
  lc: number | null
  tl: number | null
  measuredCvr: number | null
}

export type CciProfile = {
  id: string
  organizationId: string
  name: string
  versionLabel: string
  status: 'draft' | 'active' | 'archived'
}

export type CciCategory = {
  id: string
  profileId: string
  categoryOrder: number
  label: string
  value: number
  description: string | null
  metadata: Record<string, unknown>
}

export type SectionMeasurementSnapshot = {
  id: string
  sectionId: string
  packageVersionId: string
  targetCvrOhm: number
  cciProfileId: string
  cciCategoryId: string
  cciCategoryLabel: string
  cciValue: number
  supersedesSnapshotId: string | null
  overrideReason: string | null
  createdAt: string
}

export type SessionQuestionPlan = {
  packageVersionId: string
  sectionId: string
  questions: Array<{
    itemId: string
    itemOrder: number
    externalRef: string
  }>
}

type MeasurementInputs = {
  tc: number | null | undefined
  lc: number | null | undefined
  tl: number | null | undefined
}

function roundMeasurement(value: number): number {
  return Math.round(value * 100) / 100
}

function snapshotId(input: {
  sectionId: string
  packageVersionId: string
  targetCvrOhm: number
  cciCategoryId: string
  cciValue: number
  supersedesSnapshotId: string | null
  createdAt: string
}): string {
  const basis = [
    input.sectionId,
    input.packageVersionId,
    input.targetCvrOhm,
    input.cciCategoryId,
    input.cciValue,
    input.supersedesSnapshotId ?? 'root',
    input.createdAt,
  ].join(':')
  let hash = 0
  for (let i = 0; i < basis.length; i += 1) {
    hash = (hash * 31 + basis.charCodeAt(i)) >>> 0
  }
  return `sms-${hash.toString(16).padStart(8, '0')}`
}

export function assertPackageVersionCanMutate(version: Pick<TestPackageVersion, 'status'>): void {
  if (version.status !== 'draft') {
    throw new Error(
      'Published Package Versions are immutable; create a draft or measurement override snapshot instead',
    )
  }
}

export function measuredCvr(input: MeasurementInputs): number | null {
  if (input.tc == null || input.lc == null || input.tl == null) return null
  return roundMeasurement(input.tc * input.lc * input.tl)
}

export function createSectionMeasurementSnapshot(input: {
  sectionId: string
  packageVersionId: string
  targetCvrOhm: number
  cciProfileId: string
  cciCategory: CciCategory
  createdAt: string
}): SectionMeasurementSnapshot {
  const common = {
    sectionId: input.sectionId,
    packageVersionId: input.packageVersionId,
    targetCvrOhm: input.targetCvrOhm,
    cciCategoryId: input.cciCategory.id,
    cciValue: input.cciCategory.value,
    supersedesSnapshotId: null,
    createdAt: input.createdAt,
  }
  return {
    id: snapshotId(common),
    ...common,
    cciProfileId: input.cciProfileId,
    cciCategoryLabel: input.cciCategory.label,
    overrideReason: null,
  }
}

export function createMeasurementOverrideSnapshot(
  original: SectionMeasurementSnapshot,
  input: { cciCategory: CciCategory; reason: string; createdAt: string; targetCvrOhm?: number },
): SectionMeasurementSnapshot {
  const targetCvrOhm = input.targetCvrOhm ?? original.targetCvrOhm
  const common = {
    sectionId: original.sectionId,
    packageVersionId: original.packageVersionId,
    targetCvrOhm,
    cciCategoryId: input.cciCategory.id,
    cciValue: input.cciCategory.value,
    supersedesSnapshotId: original.id,
    createdAt: input.createdAt,
  }
  return {
    id: snapshotId(common),
    ...common,
    cciProfileId: input.cciCategory.profileId,
    cciCategoryLabel: input.cciCategory.label,
    overrideReason: input.reason,
  }
}

export function calculateItemCpd(
  snapshot: Pick<SectionMeasurementSnapshot, 'targetCvrOhm' | 'cciValue'>,
): number {
  return roundMeasurement(snapshot.targetCvrOhm * snapshot.cciValue)
}

export function buildSectionQuestionPlan(input: {
  version: TestPackageVersion
  section: TestSection
  items: TestItem[]
}): SessionQuestionPlan {
  if (input.version.status !== 'published') {
    throw new Error('Only published Package Versions can plan live-test Session Questions')
  }
  if (input.section.packageVersionId !== input.version.id) {
    throw new Error('Test Section must belong to the selected Package Version')
  }
  const orderedItems = [...input.items]
    .filter((candidate) => candidate.sectionId === input.section.id)
    .sort((a, b) => a.itemOrder - b.itemOrder)

  return {
    packageVersionId: input.version.id,
    sectionId: input.section.id,
    questions: orderedItems.map((testItem) => ({
      itemId: testItem.id,
      itemOrder: testItem.itemOrder,
      externalRef: `${liveTestExternalRef(testItem.id)}:v${input.version.id}`,
    })),
  }
}
