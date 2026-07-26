interface BriefingScreenProps {
  onContinue: () => void
}

export function BriefingScreen({ onContinue }: BriefingScreenProps) {
  return (
    <main className="centered-screen" aria-labelledby="briefing-title">
      <section className="briefing-card">
        <p className="eyebrow">Mission briefing</p>
        <h1 id="briefing-title">Two measurements. One clear difference.</h1>
        <div className="briefing-grid">
          <article>
            <span className="briefing-number">1</span>
            <h2>Distance</h2>
            <p>Count every unit traveled along the pirate’s route.</p>
          </article>
          <article>
            <span className="briefing-number">2</span>
            <h2>Displacement</h2>
            <p>Compare the start and finish. Give a magnitude and direction.</p>
          </article>
          <article>
            <span className="briefing-number">3</span>
            <h2>Your voyage</h2>
            <p>Complete three guided practices, then one scored assessment.</p>
          </article>
        </div>
        <div className="notice info">Practice has hints and retries. Assessment responses stay editable until final submission.</div>
        <button type="button" className="primary-button" onClick={onContinue}>Begin guided practice</button>
      </section>
    </main>
  )
}
