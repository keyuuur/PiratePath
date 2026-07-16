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
        <span aria-hidden="true">{muted ? 'Muted' : 'Sound'}</span><span>{muted ? 'Muted' : 'Sound on'}</span>
      </button>
      <button type="button" className="icon-button" onClick={() => onReducedMotionChange(!reducedMotion)} aria-pressed={reducedMotion}>
        <span aria-hidden="true">{reducedMotion ? 'Still' : 'Motion'}</span><span>{reducedMotion ? 'Reduced motion' : 'Motion on'}</span>
      </button>
    </div>
  )
}
