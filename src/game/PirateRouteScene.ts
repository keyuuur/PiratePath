import Phaser from 'phaser'
import type { GridPoint, RouteDefinition } from '../app/types'
import { areAdjacent, samePoint } from './routeMath'

const CANVAS_WIDTH = 720
const CANVAS_HEIGHT = 440

interface SceneCallbacks {
  onRouteChange: (points: GridPoint[]) => void
  onPlaybackComplete: () => void
  onPlaybackProgress: (distance: number) => void
}

interface SceneOptions {
  route: RouteDefinition
  mode: 'fixed' | 'build'
  reducedMotion: boolean
  showDisplacementVector: boolean
  initialBuildPoints?: GridPoint[]
}

export class PirateRouteScene extends Phaser.Scene {
  private options: SceneOptions | null = null
  private callbacks: SceneCallbacks = {
    onRouteChange: () => undefined,
    onPlaybackComplete: () => undefined,
    onPlaybackProgress: () => undefined,
  }
  private routePoints: GridPoint[] = []
  private routeGraphics?: Phaser.GameObjects.Graphics
  private displacementGraphics?: Phaser.GameObjects.Graphics
  private pirate?: Phaser.GameObjects.Container
  private playbackIndex = 0
  private playbackTimer?: Phaser.Time.TimerEvent
  private playbackPaused = false
  private speedMultiplier = 1

  constructor() {
    super('PirateRouteScene')
  }

  configure(options: SceneOptions, callbacks: SceneCallbacks): void {
    this.options = options
    this.callbacks = callbacks
    this.routePoints = options.mode === 'build'
      ? options.initialBuildPoints?.map((point) => ({ ...point })) ?? [{ ...options.route.start }]
      : options.route.points.map((point) => ({ ...point }))
  }

  create(): void {
    if (!this.options) return
    this.cameras.main.setBackgroundColor('#eaf4ef')
    this.drawBoard()
    this.displacementGraphics = this.add.graphics().setDepth(2)
    this.drawDisplacementVector()
    this.routeGraphics = this.add.graphics().setDepth(5)
    this.drawRoute()
    this.pirate = this.createPirate(this.routePoints[0] ?? this.options.route.start)
    this.callbacks.onRouteChange(this.routePoints.map((point) => ({ ...point })))
    this.callbacks.onPlaybackProgress(0)
  }

  private toCanvas(point: GridPoint): Phaser.Math.Vector2 {
    const columns = this.options?.route.gridWidth ?? 7
    const rows = this.options?.route.gridHeight ?? 5
    const cell = Math.min(78, (CANVAS_WIDTH - 150) / Math.max(1, columns - 1), (CANVAS_HEIGHT - 130) / Math.max(1, rows - 1))
    const gridWidth = (columns - 1) * cell
    const gridHeight = (rows - 1) * cell
    return new Phaser.Math.Vector2(
      (CANVAS_WIDTH - gridWidth) / 2 + point.x * cell,
      64 + gridHeight - point.y * cell,
    )
  }

  private drawBoard(): void {
    if (!this.options) return
    const backdrop = this.add.graphics()
    backdrop.fillStyle(0xf9f3de, 1)
    backdrop.fillRoundedRect(24, 20, 672, 392, 22)
    backdrop.lineStyle(4, 0x163b4a, 0.22)
    backdrop.strokeRoundedRect(24, 20, 672, 392, 22)

    for (let y = 0; y < this.options.route.gridHeight; y += 1) {
      for (let x = 0; x < this.options.route.gridWidth; x += 1) {
        const point = { x, y }
        const canvas = this.toCanvas(point)
        const blocked = this.options.route.blockedPoints?.some((item) => samePoint(item, point)) ?? false
        if (blocked) {
          const block = this.add.rectangle(canvas.x, canvas.y, 48, 48, 0xc86752, 0.9)
          block.setStrokeStyle(3, 0x8a2f25)
          this.add.text(canvas.x, canvas.y, '×', {
            fontFamily: 'Arial', fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
          }).setOrigin(0.5)
          continue
        }
        const node = this.add.circle(canvas.x, canvas.y, 12, 0xffffff, 1)
        node.setStrokeStyle(3, 0x75919d, 0.8)
        if (this.options.mode === 'build') {
          node.setInteractive(new Phaser.Geom.Rectangle(-38, -38, 76, 76), Phaser.Geom.Rectangle.Contains)
          node.input!.cursor = 'pointer'
          node.on('pointerdown', () => this.handleNodeTap(point))
        }
      }
    }

    this.drawLocationMarker(this.options.route.start, 'START', 0x0e784a)
    this.drawLocationMarker(this.options.route.target, 'FINISH', 0xb06d16)
    if (this.options.route.requiredPoint) this.drawLocationMarker(this.options.route.requiredPoint, 'CHECK', 0x6847a8)
  }

  private drawLocationMarker(point: GridPoint, label: string, color: number): void {
    const canvas = this.toCanvas(point)
    const marker = this.add.circle(canvas.x, canvas.y, 22, color, 0.12)
    marker.setStrokeStyle(4, color, 1)
    this.add.text(canvas.x, canvas.y - 34, label, {
      fontFamily: 'Arial', fontSize: '14px', color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold', backgroundColor: '#fffaf0', padding: { x: 5, y: 2 },
    }).setOrigin(0.5)
  }

  private drawDisplacementVector(): void {
    if (!this.options || !this.displacementGraphics) return
    const reachesTarget = samePoint(this.routePoints.at(-1) ?? this.options.route.start, this.options.route.target)
    this.displacementGraphics.clear()
    if (!this.options.showDisplacementVector || (this.options.mode === 'build' && !reachesTarget)) return
    const start = this.toCanvas(this.options.route.start)
    const end = this.toCanvas(this.options.route.target)
    const graphics = this.displacementGraphics
    graphics.lineStyle(5, 0x1769aa, 0.92)
    const length = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y)
    if (length < 1) {
      graphics.strokeCircle(start.x, start.y, 32)
      return
    }
    const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y)
    for (let offset = 0; offset < length - 18; offset += 21) {
      const to = Math.min(offset + 13, length - 18)
      graphics.lineBetween(
        start.x + Math.cos(angle) * offset, start.y + Math.sin(angle) * offset,
        start.x + Math.cos(angle) * to, start.y + Math.sin(angle) * to,
      )
    }
    graphics.fillStyle(0x1769aa, 1)
    graphics.fillTriangle(
      end.x, end.y,
      end.x - Math.cos(angle - 0.55) * 22, end.y - Math.sin(angle - 0.55) * 22,
      end.x - Math.cos(angle + 0.55) * 22, end.y - Math.sin(angle + 0.55) * 22,
    )
  }

  private handleNodeTap(point: GridPoint): void {
    if (!this.options || this.options.mode !== 'build') return
    if (this.options.route.blockedPoints?.some((item) => samePoint(item, point))) return
    const last = this.routePoints.at(-1) ?? this.options.route.start
    const previous = this.routePoints.at(-2)
    if (previous && samePoint(previous, point)) this.routePoints.pop()
    else if (!this.routePoints.some((item) => samePoint(item, point)) && areAdjacent(last, point)) this.routePoints.push({ ...point })
    else {
      this.tweens.add({ targets: this.pirate, angle: { from: -4, to: 4 }, yoyo: true, duration: 75, repeat: 1 })
      return
    }
    this.afterRouteEdit()
  }

  private afterRouteEdit(): void {
    this.stopPlayback()
    this.playbackIndex = 0
    this.drawRoute()
    this.drawDisplacementVector()
    this.movePirateTo(this.routePoints[0])
    this.callbacks.onPlaybackProgress(0)
    this.callbacks.onRouteChange(this.routePoints.map((item) => ({ ...item })))
  }

  private drawRoute(completedIndex = this.routePoints.length - 1): void {
    if (!this.routeGraphics) return
    this.routeGraphics.clear()
    if (this.routePoints.length < 2) return
    const first = this.toCanvas(this.routePoints[0])
    this.routeGraphics.lineStyle(12, 0xc53b3b, 0.25)
    this.routeGraphics.beginPath().moveTo(first.x, first.y)
    this.routePoints.slice(1).forEach((point) => {
      const canvas = this.toCanvas(point)
      this.routeGraphics?.lineTo(canvas.x, canvas.y)
    })
    this.routeGraphics.strokePath()
    this.routeGraphics.lineStyle(9, 0xc53b3b, 1)
    this.routeGraphics.beginPath().moveTo(first.x, first.y)
    for (let index = 1; index <= Math.min(completedIndex, this.routePoints.length - 1); index += 1) {
      const canvas = this.toCanvas(this.routePoints[index])
      this.routeGraphics.lineTo(canvas.x, canvas.y)
    }
    this.routeGraphics.strokePath()
  }

  private createPirate(point: GridPoint): Phaser.GameObjects.Container {
    const canvas = this.toCanvas(point)
    const body = this.add.circle(0, 0, 24, 0x0e784a, 1).setStrokeStyle(4, 0xffffff, 1)
    const label = this.add.text(0, 1, 'P', { fontFamily: 'Georgia', fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    const hat = this.add.triangle(0, -26, -22, 14, 22, 14, 0, -10, 0x163b4a, 1)
    return this.add.container(canvas.x, canvas.y, [body, label, hat]).setDepth(10)
  }

  private movePirateTo(point: GridPoint): void {
    if (!this.pirate) return
    const canvas = this.toCanvas(point)
    this.pirate.setPosition(canvas.x, canvas.y)
  }

  play(): void {
    if (!this.options || this.routePoints.length < 2) return
    if (this.options.reducedMotion) {
      this.playbackIndex = this.routePoints.length - 1
      this.drawRoute(this.playbackIndex)
      this.movePirateTo(this.routePoints[this.playbackIndex])
      this.callbacks.onPlaybackProgress(this.playbackIndex)
      this.callbacks.onPlaybackComplete()
      return
    }
    if (this.playbackIndex >= this.routePoints.length - 1) this.replay(false)
    this.playbackPaused = false
    this.scheduleNextStep()
  }

  pause(): void {
    this.playbackPaused = true
    this.playbackTimer?.remove(false)
    this.playbackTimer = undefined
  }

  step(): void {
    this.pause()
    this.playbackIndex = this.playbackIndex >= this.routePoints.length - 1 ? 0 : this.playbackIndex + 1
    this.drawRoute(this.playbackIndex)
    this.movePirateTo(this.routePoints[this.playbackIndex])
    this.callbacks.onPlaybackProgress(this.playbackIndex)
    if (this.playbackIndex === this.routePoints.length - 1) this.callbacks.onPlaybackComplete()
  }

  replay(autoPlay = true): void {
    this.stopPlayback()
    this.playbackIndex = 0
    this.drawRoute(0)
    this.movePirateTo(this.routePoints[0])
    this.callbacks.onPlaybackProgress(0)
    if (autoPlay) this.play()
  }

  setSpeed(multiplier: 1 | 2): void { this.speedMultiplier = multiplier }

  undo(): void {
    if (this.options?.mode !== 'build' || this.routePoints.length <= 1) return
    this.routePoints.pop()
    this.afterRouteEdit()
  }

  clearRoute(): void {
    if (!this.options || this.options.mode !== 'build') return
    this.routePoints = [{ ...this.options.route.start }]
    this.afterRouteEdit()
  }

  replaceBuildRoute(points: GridPoint[]): void {
    if (!this.options || this.options.mode !== 'build') return
    this.routePoints = points.map((point) => ({ ...point }))
    this.afterRouteEdit()
  }

  private scheduleNextStep(): void {
    if (this.playbackPaused || this.playbackIndex >= this.routePoints.length - 1) return
    this.playbackTimer?.remove(false)
    this.playbackTimer = this.time.delayedCall(400 / this.speedMultiplier, () => {
      this.playbackIndex += 1
      this.drawRoute(this.playbackIndex)
      this.movePirateTo(this.routePoints[this.playbackIndex])
      this.callbacks.onPlaybackProgress(this.playbackIndex)
      if (this.playbackIndex >= this.routePoints.length - 1) this.callbacks.onPlaybackComplete()
      else this.scheduleNextStep()
    })
  }

  private stopPlayback(): void {
    this.playbackPaused = true
    this.playbackTimer?.remove(false)
    this.playbackTimer = undefined
  }
}
