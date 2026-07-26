import { describe, expect, it } from 'vitest'
import { cardinalDisplacementOrNull } from '../../src/game/routeMath'

describe('route UI displacement', () => {
  it('keeps temporary diagonal planning endpoints unclassified instead of crashing', () => {
    expect(cardinalDisplacementOrNull({ x: 0, y: 0 }, { x: 2, y: 1 })).toBeNull()
  })

  it('classifies completed cardinal and zero endpoints', () => {
    expect(cardinalDisplacementOrNull({ x: 1, y: 1 }, { x: 1, y: 4 })).toEqual({
      magnitude: 3,
      direction: 'north',
    })
    expect(cardinalDisplacementOrNull({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({
      magnitude: 0,
      direction: 'none',
    })
  })
})
