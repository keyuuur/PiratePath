import type { CardinalDirection, GridPoint } from '../app/types'

export function samePoint(left: GridPoint, right: GridPoint): boolean {
  return left.x === right.x && left.y === right.y
}

export function areAdjacent(left: GridPoint, right: GridPoint): boolean {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1
}

export function routeDistance(points: GridPoint[]): number {
  return Math.max(0, points.length - 1)
}

export function displacement(start: GridPoint, end: GridPoint): {
  magnitude: number
  direction: CardinalDirection
} {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return { magnitude: 0, direction: 'none' }
  if (dx !== 0 && dy !== 0) {
    throw new Error('Pirate Path v2 supports cardinal displacement only.')
  }
  if (dx > 0) return { magnitude: dx, direction: 'east' }
  if (dx < 0) return { magnitude: Math.abs(dx), direction: 'west' }
  if (dy > 0) return { magnitude: dy, direction: 'north' }
  return { magnitude: Math.abs(dy), direction: 'south' }
}

export function cardinalDisplacementOrNull(
  start: GridPoint,
  end: GridPoint,
): ReturnType<typeof displacement> | null {
  if (start.x !== end.x && start.y !== end.y) return null
  return displacement(start, end)
}

export function describeRoute(points: GridPoint[]): string {
  if (points.length === 0) return 'No route is currently shown.'
  if (points.length === 1) return `The pirate starts at column ${points[0].x + 1}, row ${points[0].y + 1}.`

  const moves: string[] = []
  let direction = ''
  let count = 0
  const flush = () => {
    if (direction && count) moves.push(`${direction} ${count}`)
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const nextDirection = current.x > previous.x
      ? 'east'
      : current.x < previous.x
        ? 'west'
        : current.y > previous.y
          ? 'north'
          : 'south'
    if (nextDirection !== direction) {
      flush()
      direction = nextDirection
      count = 1
    } else {
      count += 1
    }
  }
  flush()
  const end = points.at(-1)!
  return `Start at column ${points[0].x + 1}, row ${points[0].y + 1}. Move ${moves.join(', then ')}. Finish at column ${end.x + 1}, row ${end.y + 1}.`
}
