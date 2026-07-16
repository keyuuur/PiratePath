interface ReadinessScreenProps { onBegin: () => void }

export function ReadinessScreen({ onBegin }: ReadinessScreenProps) {
  return (
    <main className="centered-screen" aria-labelledby="ready-title">
      <section className="briefing-card readiness-card">
        <span className="ready-icon" aria-hidden="true">✓</span>
        <p className="eyebrow">Practice complete</p>
        <h1 id="ready-title">Ready for the scored voyage?</h1>
        <ul className="ready-list"><li>Five route missions</li><li>Three rapid-check questions</li><li>One final submission</li></ul>
        <div className="notice info">Your answers stay editable until you press Final Submit.</div>
        <button type="button" className="primary-button" onClick={onBegin}>Begin scored voyage</button>
      </section>
    </main>
  )
}
