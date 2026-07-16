interface ProgressHeaderProps { label: string; step: string; saved: boolean }

export function ProgressHeader({ label, step, saved }: ProgressHeaderProps) {
  return (
    <header className="game-header">
      <div className="brand-lockup">
        <span className="pirate-mark" aria-hidden="true">P</span>
        <div><span className="eyebrow">Pirate Path</span><strong>{label}</strong></div>
      </div>
      <div className="progress-readout" aria-label={`${step}. ${saved ? 'Progress saved' : 'Saving progress'}`}>
        <strong>{step}</strong>
        <span className={saved ? 'save-state saved' : 'save-state'}>{saved ? '● Saved' : '○ Saving'}</span>
      </div>
    </header>
  )
}
