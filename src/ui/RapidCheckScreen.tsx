import type { ProbeDefinition } from '../app/types'

interface RapidCheckScreenProps {
  probes: ProbeDefinition[]
  responses: Record<string, string>
  error: string
  returnToReview: boolean
  onChange: (probeId: string, value: string) => void
  onContinue: () => void
}

export function RapidCheckScreen({ probes, responses, error, returnToReview, onChange, onContinue }: RapidCheckScreenProps) {
  return (
    <main className="rapid-screen" aria-labelledby="rapid-title">
      <section className="mission-prompt compact">
        <div>
          <p className="eyebrow">Rapid check</p>
          <h1 id="rapid-title">Three final concept probes</h1>
          <p>Choose one answer for each. Correctness appears after final submission.</p>
        </div>
      </section>
      <div className="probe-list">
        {probes.map((probe, index) => (
          <fieldset key={probe.id} className="probe-card">
            <legend><span>{index + 1}</span>{probe.prompt}</legend>
            <div className="probe-options">
              {probe.options.map((option) => (
                <label key={option.value} className={responses[probe.id] === option.value ? 'selected' : ''}>
                  <input
                    type="radio"
                    name={probe.id}
                    checked={responses[probe.id] === option.value}
                    onChange={() => onChange(probe.id, option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      <button type="button" className="primary-button wide-action" onClick={onContinue}>
        {returnToReview ? 'Save and return to review' : 'Save and review all responses'}
      </button>
    </main>
  )
}
