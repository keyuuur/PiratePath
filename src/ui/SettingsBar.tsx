interface SettingsBarProps {
  muted: boolean
  reducedMotion: boolean
  onMutedChange: (muted: boolean) => void
  onReducedMotionChange: (reduced: boolean) => void
}

export function SettingsBar({ muted, reducedMotion, onMutedChange, onReducedMotionChange }: SettingsBarProps) {
  return (
    <div className="settings-bar" aria-label="Game settings">
      <button type="button" className="icon-button" onClick={() => onMutedChange(!muted)} aria-pressed={muted}>
        {muted ? 'Muted' : 'Sound on'}
      </button>
      <button type="button" className="icon-button" onClick={() => onReducedMotionChange(!reducedMotion)} aria-pressed={reducedMotion}>
        {reducedMotion ? 'Reduced motion' : 'Motion on'}
      </button>
    </div>
  )
}
