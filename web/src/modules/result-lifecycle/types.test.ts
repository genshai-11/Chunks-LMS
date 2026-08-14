import { describe, expect, it } from 'vitest'
import {
  COOL_COLORS,
  PRIMARY_OBSERVATION_COLORS,
  RESULT_COLORS,
  RESULT_COLOR_META,
  WARM_COLORS,
  isCoolColor,
  isWarmColor,
} from './types'

describe('seven-color semantics', () => {
  it('defines one ordered English catalog and direct-observation subset', () => {
    expect(RESULT_COLORS).toEqual([
      'red',
      'orange',
      'yellow',
      'green',
      'blue',
      'indigo',
      'purple',
    ])
    expect(RESULT_COLORS.map((color) => RESULT_COLOR_META[color].label)).toEqual([
      'Red',
      'Orange',
      'Yellow',
      'Green',
      'Blue',
      'Indigo',
      'Purple',
    ])
    expect(PRIMARY_OBSERVATION_COLORS).toEqual(['red', 'orange', 'green', 'purple'])
  })

  it('partitions every color exactly once into warm RFC and cool RAC', () => {
    expect(WARM_COLORS).toEqual(['red', 'orange', 'yellow'])
    expect(COOL_COLORS).toEqual(['green', 'blue', 'indigo', 'purple'])
    expect(new Set([...WARM_COLORS, ...COOL_COLORS])).toEqual(new Set(RESULT_COLORS))
    for (const color of RESULT_COLORS) {
      expect(Number(isWarmColor(color)) + Number(isCoolColor(color))).toBe(1)
    }
  })
})
