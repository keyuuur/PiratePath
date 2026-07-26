import { useRef, useState } from 'react'
import type { GridPoint, MissionDefinition, NumberDirectionResponse } from '../app/types'
import { RouteGame, type RouteGameHandle } from '../game/RouteGame'
import { cardinalDisplacementOrNull, describeRoute, routeDistance, samePoint } from '../game/routeMath'
import { MeasurementFields } from './MeasurementFields'

interface MissionScreenProps {
  mission: MissionDefinition
  response: NumberDirectionResponse
  routePoints: GridPoint[]
  reducedMotion: boolean
  practice: boolean
  practiceAttempts: number
  feedback: '' | 'correct' | 'retry'
  error: string
  returnToReview: boolean
  onResponseChange: (response: NumberDirectionResponse) => void
  onRouteChange: (points: GridPoint[]) => void
  onCheckPractice: (vectorPlaced: boolean) => void
  onContinue: () => void
}

const BUILD_MOVES = [
  { label: 'North', short: 'N ↑', dx: 0, dy: 1 },
  { label: 'West', short: 'W ←', dx: -1, dy: 0 },
  { label: 'South', short: 'S ↓', dx: 0, dy: -1 },
  { label: 'East', short: 'E →', dx: 1, dy: 0 },
] as const

export function MissionScreen({
  mission,
  response,
  routePoints,
  reducedMotion,
  practice,
  practiceAttempts,
  feedback,
  error,
  returnToReview,
  onResponseChange,
  onRouteChange,
  onCheckPractice,
  onContinue,
}: MissionScreenProps) {
  const gameRef = useRef<RouteGameHandle>(null)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const [played, setPlayed] = useState(false)
  const [observedDistance, setObservedDistance] = useState(0)
  const [vectorStartPlaced, setVectorStartPlaced] = useState(false)
  const [vectorFinishPlaced, setVectorFinishPlaced] = useState(false)
  const activePoints = mission.mode === 'build' ? routePoints : mission.route.points
  const reachesTarget = activePoints.length > 1 && samePoint(activePoints.at(-1)!, mission.route.target)
  const needsVectorPlacement = practice && mission.id === 'P2'
  const workedDistance = routeDistance(activePoints)
  const activeEnd = activePoints.at(-1)
  // Planned routes may pass through a temporary diagonal endpoint while students build them.
  // Only classify displacement after the current endpoint is cardinal or back at the start.
  const workedDisplacement = activePoints.length > 1 && activeEnd
    ? cardinalDisplacementOrNull(activePoints[0], activeEnd)
    : null

  function toggleSpeed() {
    const next = speed === 1 ? 2 : 1
    setSpeed(next)
    gameRef.current?.setSpeed(next)
  }

  function play() {
    setPlayed(true)
    gameRef.current?.play()
  }

  function addKeyboardMove(dx: number, dy: number) {
    const last = routePoints.at(-1) ?? mission.route.start
    const next = { x: last.x + dx, y: last.y + dy }
    if (next.x < 0 || next.y < 0 || next.x >= mission.route.gridWidth || next.y >= mission.route.gridHeight) return
    if (mission.route.blockedPoints?.some((point) => samePoint(point, next))) return
    const previous = routePoints.at(-2)
    let updated: GridPoint[]
    if (previous && samePoint(previous, next)) updated = routePoints.slice(0, -1)
    else if (routePoints.some((point) => samePoint(point, next))) return
    else updated = [...routePoints, next]
    onRouteChange(updated)
    gameRef.current?.replaceRoute(updated)
  }

  return (
    <main className="mission-screen" aria-labelledby="mission-title">
      <section className="mission-prompt">
        <div>
          <p className="eyebrow">{mission.eyebrow}</p>
          <h1 id="mission-title">{mission.id}: {mission.title}</h1>
          <p>{mission.prompt}</p>
        </div>
        {mission.constraintLabel && <div className="constraint-chip">⚑ {mission.constraintLabel}</div>}
      </section>

      <div className="mission-layout">
        <section className="map-card" aria-label="Pirate route map">
          <RouteGame
            ref={gameRef}
            mission={mission}
            reducedMotion={reducedMotion}
            initialBuildPoints={routePoints}
            onRouteChange={onRouteChange}
            onPlaybackComplete={() => setPlayed(true)}
            onPlaybackProgress={setObservedDistance}
            showDisplacementVector={!needsVectorPlacement || vectorFinishPlaced}
          />
          <p className="sr-only" aria-live="polite">{describeRoute(activePoints)}</p>
          <div className="map-legend" aria-hidden="true">
            <span><i className="path-sample" /> Distance path</span>
            <span><i className="vector-sample" /> Start-to-finish displacement</span>
          </div>
          {practice && played && <div className="distance-counter" aria-live="polite">Distance traveled: <strong>{observedDistance} m</strong></div>}
          {needsVectorPlacement && (
            <div className="vector-placement" aria-label="Place the displacement vector">
              <strong>Place the vector from START to FINISH.</strong>
              <button
                type="button"
                className={vectorStartPlaced ? 'placed' : ''}
                onClick={() => { setVectorStartPlaced(true); setVectorFinishPlaced(false) }}
              >
                {vectorStartPlaced ? '✓ START selected' : '1. Tap START'}
              </button>
              <button
                type="button"
                className={vectorFinishPlaced ? 'placed' : ''}
                disabled={!vectorStartPlaced}
                onClick={() => setVectorFinishPlaced(true)}
              >
                {vectorFinishPlaced ? '✓ FINISH connected' : '2. Tap FINISH'}
              </button>
            </div>
          )}
          {mission.mode === 'build' && (
            <div className="keyboard-builder" aria-label="Keyboard route builder">
              <span>Build with taps or direction buttons:</span>
              {BUILD_MOVES.map((move) => (
                <button key={move.label} type="button" onClick={() => addKeyboardMove(move.dx, move.dy)} aria-label={`Add one meter ${move.label}`}>
                  {move.short}
                </button>
              ))}
            </div>
          )}
          <div className="playback-controls" aria-label="Route controls">
            {mission.mode === 'build' ? (
              <>
                <button type="button" onClick={() => gameRef.current?.undo()}>Undo</button>
                <button type="button" onClick={() => gameRef.current?.clear()}>Clear</button>
                <button type="button" className="control-primary" onClick={play} disabled={!reachesTarget}>Launch</button>
              </>
            ) : <button type="button" className="control-primary" onClick={play}>{played ? 'Replay route' : 'Play route'}</button>}
            <button type="button" onClick={() => gameRef.current?.pause()}>Pause</button>
            <button type="button" onClick={() => gameRef.current?.step()}>Step</button>
            <button type="button" onClick={toggleSpeed} aria-pressed={speed === 2}>{speed}× speed</button>
          </div>
          {mission.mode === 'build' && !reachesTarget && <p className="map-help">Add adjacent squares until your route reaches FINISH.</p>}
        </section>

        <section className="answer-card" aria-labelledby="measurements-title">
          <div><p className="eyebrow">Your measurements</p><h2 id="measurements-title">Distance and displacement</h2></div>
          <MeasurementFields value={response} onChange={onResponseChange} />
          {practice && feedback === 'retry' && (
            <div className="notice hint" role="alert">
              <strong>Try again.</strong> {practiceAttempts >= 2 ? mission.workedHint : mission.hint}
              {practiceAttempts >= 2 && workedDisplacement && (
                <div className="worked-panel">
                  <div><i className="path-sample" /><strong>Distance:</strong> add all route segments = {workedDistance} m</div>
                  <div><i className="vector-sample" /><strong>Displacement:</strong> START → FINISH = {workedDisplacement.magnitude} m {workedDisplacement.direction}</div>
                </div>
              )}
            </div>
          )}
          {practice && feedback === 'correct' && (
            <div className="notice success" role="status"><strong>Ready to sail.</strong> Your measurements match the route.</div>
          )}
          {error && <div className="notice error" role="alert">{error}</div>}
          <button type="button" className="primary-button" onClick={practice && feedback !== 'correct' ? () => onCheckPractice(vectorFinishPlaced) : onContinue}>
            {practice && feedback !== 'correct'
              ? 'Check practice answer'
              : practice
                ? 'Next practice mission'
                : returnToReview
                  ? 'Save and return to review'
                  : 'Save and continue'}
          </button>
          {!practice && <p className="withheld-note">Correctness is shown only after final submission.</p>}
        </section>
      </div>
    </main>
  )
}
