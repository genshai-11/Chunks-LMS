import { describe, expect, it } from 'vitest'
import { projectStandaloneRunItems } from './run-projection'

function finalizedItem(index: number): any {
  return {
    id: `item-${index}`,
    standalone_test_attempts: [
      {
        id: `attempt-${index}`,
        standalone_test_attempt_snapshots: {
          status: 'finalized',
          effective_color: 'purple',
          entered_probe_flow: false,
          probe_count: 0,
        },
        standalone_test_events: [],
      },
    ],
  }
}

describe('standalone main/probe projection', () => {
  it('keeps 49 main items separate from immutable probe history and expanded totals', () => {
    const items = Array.from({ length: 49 }, (_, index) => finalizedItem(index + 1))
    items[8] = {
      id: 'item-9',
      standalone_test_attempts: [
        {
          id: 'attempt-9',
          standalone_test_attempt_snapshots: {
            status: 'finalized',
            effective_color: 'indigo',
            entered_probe_flow: true,
            probe_count: 2,
          },
          standalone_test_events: [
            { event_sequence: 2, event_type: 'provisional_recorded', payload: { color: 'green' } },
            { event_sequence: 3, event_type: 'probe_continued', payload: { probe_count: 1 } },
            { event_sequence: 4, event_type: 'probe_continued', payload: { probe_count: 2 } },
            { event_sequence: 5, event_type: 'probe_completed', payload: {} },
            { event_sequence: 6, event_type: 'result_finalized', payload: { color: 'indigo' } },
          ],
        },
      ],
    }

    const projection = projectStandaloneRunItems(items)

    expect(projection.mainQuestions).toBe(49)
    expect(projection.completedMainQuestions).toBe(49)
    expect(projection.nCount).toBe(1)
    expect(projection.items[8]?.nDepth).toBe(3)
    expect(projection.items[8]?.probeSteps.map((step) => step.color)).toEqual([
      'green',
      'blue',
      'blue',
      'indigo',
    ])
    expect(projection.probeSteps).toBe(4)
    expect(projection.expandedTotal).toBe(53)
  })

  it('counts repeated Green entries from events rather than only the current snapshot color', () => {
    const item = finalizedItem(1)
    item.standalone_test_attempts[0]!.standalone_test_attempt_snapshots = {
      status: 'corrected',
      effective_color: 'yellow',
      entered_probe_flow: true,
      probe_count: 0,
    }
    item.standalone_test_attempts[0]!.standalone_test_events = [
      { event_sequence: 2, event_type: 'provisional_recorded', payload: { color: 'green' } },
      { event_sequence: 3, event_type: 'probe_completed', payload: {} },
      { event_sequence: 5, event_type: 'result_corrected', payload: { color: 'green' } },
      { event_sequence: 6, event_type: 'probe_failed', payload: {} },
      { event_sequence: 7, event_type: 'result_finalized', payload: { color: 'yellow' } },
    ]

    const projection = projectStandaloneRunItems([item])
    expect(projection.nCount).toBe(2)
    expect(projection.items[0]?.probeSteps.map((step) => step.color)).toEqual([
      'green',
      'indigo',
      'green',
      'yellow',
    ])
  })
})
