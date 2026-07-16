import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Phaser from 'phaser'
import type { GridPoint, MissionDefinition } from '../app/types'
import { PirateRouteScene } from './PirateRouteScene'

export interface RouteGameHandle {
  play: () => void
  pause: () => void
  step: () => void
  replay: () => void
  setSpeed: (speed: 1 | 2) => void
  undo: () => void
  clear: () => void
  replaceRoute: (points: GridPoint[]) => void
}

interface RouteGameProps {
  mission: MissionDefinition
  reducedMotion: boolean
  initialBuildPoints?: GridPoint[]
  onRouteChange: (points: GridPoint[]) => void
  onPlaybackComplete: () => void
  onPlaybackProgress: (distance: number) => void
  showDisplacementVector?: boolean
}

export const RouteGame = forwardRef<RouteGameHandle, RouteGameProps>(function RouteGame(
  { mission, reducedMotion, initialBuildPoints, onRouteChange, onPlaybackComplete, onPlaybackProgress, showDisplacementVector = true },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<PirateRouteScene | null>(null)
  const callbackRef = useRef({ onRouteChange, onPlaybackComplete, onPlaybackProgress })
  callbackRef.current = { onRouteChange, onPlaybackComplete, onPlaybackProgress }
  const initialPointsRef = useRef(initialBuildPoints)
  initialPointsRef.current = initialBuildPoints

  useImperativeHandle(ref, () => ({
    play: () => sceneRef.current?.play(),
    pause: () => sceneRef.current?.pause(),
    step: () => sceneRef.current?.step(),
    replay: () => sceneRef.current?.replay(),
    setSpeed: (speed) => sceneRef.current?.setSpeed(speed),
    undo: () => sceneRef.current?.undo(),
    clear: () => sceneRef.current?.clearRoute(),
    replaceRoute: (points) => sceneRef.current?.replaceBuildRoute(points),
  }), [])

  useEffect(() => {
    if (!hostRef.current) return
    const scene = new PirateRouteScene()
    scene.configure(
      { route: mission.route, mode: mission.mode, reducedMotion, showDisplacementVector, initialBuildPoints: initialPointsRef.current },
      {
        onRouteChange: (points) => callbackRef.current.onRouteChange(points),
        onPlaybackComplete: () => callbackRef.current.onPlaybackComplete(),
        onPlaybackProgress: (distance) => callbackRef.current.onPlaybackProgress(distance),
      },
    )
    sceneRef.current = scene
    const game = new Phaser.Game({
      // Headless verification uses Canvas to avoid software-WebGL stalls; classroom builds use AUTO.
      type: import.meta.env.VITE_FORCE_CANVAS === 'true' ? Phaser.CANVAS : Phaser.AUTO,
      parent: hostRef.current,
      width: 720,
      height: 440,
      backgroundColor: '#eaf4ef',
      scene: [scene],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, roundPixels: true },
      audio: { noAudio: true },
    })
    return () => {
      sceneRef.current = null
      game.destroy(true)
    }
  }, [mission, reducedMotion, showDisplacementVector])

  return <div className="route-game" ref={hostRef} aria-hidden="true" />
})
