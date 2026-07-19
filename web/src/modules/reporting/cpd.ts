import { getSupabase } from '../../lib/supabase'
import { env } from '../../env'
import type { ResultColor } from '../result-lifecycle/types'
import { COLOR_SCORE } from '../result-lifecycle/types'
import type { ReportWindow } from './report-window'
import { isInWindow } from './report-window'
import type { ResultRecord } from './progress'
import { effectiveResults } from '../ops/effective-results'

export type CpdItemRecord = {
  attemptId: string
  learningSessionId: string
  sessionQuestionId: string
  packageVersionId: string | null
  packageVersionLabel: string
  sectionMeasurementSnapshotId: string | null
  targetCvrOhm: number
  cciValue: number
  itemCpd: number
  effectiveColor: ResultColor | null
  effectiveScore: number | null
  learnerCpdScore: number | null
  finalizedAt: string
}

export type LearnerCpdReport = {
  learnerUserId: string
  totalAttempts: number
  averageItemCpd: number | null
  averageLearnerCpdScore: number | null
  items: CpdItemRecord[]
  provenance: {
    packageVersions: string[]
    measurementSnapshots: string[]
  }
}

export async function calculateLearnerCpd(query: {
  learnerId: string
  reportWindow: ReportWindow
  courseId?: string
  classId?: string
  /** Local in-memory fallback ledger when offline / CI */
  fallbackLedger?: ResultRecord[]
}): Promise<LearnerCpdReport> {
  const supabase = getSupabase()

  // Online Database Path (Canonical RPC)
  if (supabase && !env.authBypass) {
    const { data, error } = await (supabase as any).rpc('calculate_learner_cpd_report', {
      p_learner_user_id: query.learnerId,
      p_course_id: query.courseId || null,
      p_class_id: query.classId || null,
    })

    if (error) {
      throw new Error(`calculateLearnerCpd failed: ${error.message}`)
    }

    const report = data as Record<string, any>
    
    // Filter by window on the returned items if needed, or if RPC is already filtered
    const items = (report.items as any[] || []).filter((item) => 
      isInWindow(item.finalizedAt, query.reportWindow)
    )

    const totalAttempts = items.length
    const averageItemCpd = totalAttempts > 0 
      ? Math.round((items.reduce((sum, i) => sum + Number(i.itemCpd), 0) / totalAttempts) * 100) / 100
      : 0
    const averageLearnerCpdScore = totalAttempts > 0 
      ? Math.round((items.reduce((sum, i) => sum + Number(i.learnerCpdScore), 0) / totalAttempts) * 100) / 100
      : 0

    return {
      learnerUserId: query.learnerId,
      totalAttempts,
      averageItemCpd,
      averageLearnerCpdScore,
      items: items as CpdItemRecord[],
      provenance: {
        packageVersions: [...new Set(items.map((i) => i.packageVersionId).filter(Boolean))] as string[],
        measurementSnapshots: [...new Set(items.map((i) => i.sectionMeasurementSnapshotId).filter(Boolean))] as string[],
      }
    }
  }

  // Offline / CI Memory Path (Local Mock Math)
  const ledger = query.fallbackLedger || []
  
  // 1. Filter ledger by course, class, learner, and window
  const filtered = ledger.filter((r) => {
    if (r.learnerUserId !== query.learnerId) return false
    if (query.courseId && r.courseId !== query.courseId) return false
    if (query.classId && r.classId !== query.classId) return false
    return isInWindow(r.finalizedAt, query.reportWindow)
  })

  // 2. Get latest effective result per attempt
  const effective = effectiveResults(filtered)

  // 3. Project each record to a CPD item record
  const items: CpdItemRecord[] = effective.map((r) => {
    // Mock CVR/CCI assumptions (e.g. cvr = 5, cci = 4)
    const targetCvrOhm = 5
    const cciValue = 4
    const itemCpd = targetCvrOhm * cciValue
    const score = COLOR_SCORE[r.effectiveColor]
    const learnerCpdScore = itemCpd * score

    return {
      attemptId: r.id,
      learningSessionId: r.learningSessionId,
      sessionQuestionId: r.sessionQuestionId,
      packageVersionId: 'mock-pkg-version-id',
      packageVersionLabel: '1.0.0-mock',
      sectionMeasurementSnapshotId: 'mock-snapshot-id',
      targetCvrOhm,
      cciValue,
      itemCpd,
      effectiveColor: r.effectiveColor,
      effectiveScore: score,
      learnerCpdScore,
      finalizedAt: r.finalizedAt,
    }
  })

  const totalAttempts = items.length
  const averageItemCpd = totalAttempts > 0 
    ? Math.round((items.reduce((sum, i) => sum + i.itemCpd, 0) / totalAttempts) * 100) / 100
    : null
  const averageLearnerCpdScore = totalAttempts > 0 
    ? Math.round((items.reduce((sum, i) => sum + (i.learnerCpdScore || 0), 0) / totalAttempts) * 100) / 100
    : null

  return {
    learnerUserId: query.learnerId,
    totalAttempts,
    averageItemCpd,
    averageLearnerCpdScore,
    items,
    provenance: {
      packageVersions: totalAttempts > 0 ? ['mock-pkg-version-id'] : [],
      measurementSnapshots: totalAttempts > 0 ? ['mock-snapshot-id'] : [],
    }
  }
}
