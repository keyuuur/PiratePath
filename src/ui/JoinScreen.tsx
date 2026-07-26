import { useState, type FormEvent } from 'react'
import type { StudentIdentity } from '../app/types'

interface JoinScreenProps {
  joining: boolean
  error: string
  demoMode: boolean
  onJoin: (identity: StudentIdentity) => void
}

const PERIODS = ['1st hour', '2nd hour', '3rd hour', '4th hour', '5th hour', '6th hour', '7th hour']

export function JoinScreen({ joining, error, demoMode, onJoin }: JoinScreenProps) {
  const [identity, setIdentity] = useState<StudentIdentity>({
    firstName: '', lastName: '', classPeriod: '', sessionCode: '',
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onJoin(identity)
  }

  return (
    <main className="join-layout">
      <section className="join-hero" aria-labelledby="join-title">
        <div className="hero-emblem" aria-hidden="true"><span>P</span></div>
        <p className="eyebrow">Distance + displacement</p>
        <h1 id="join-title">Chart the pirate’s path.</h1>
        <p>Watch routes, plan your own, and measure every voyage.</p>
        <div className="concept-pair" aria-label="Game concepts">
          <span><i className="path-sample" /> Distance follows the route</span>
          <span><i className="vector-sample" /> Displacement connects start to finish</span>
        </div>
      </section>

      <form className="join-card" onSubmit={submit}>
        <div>
          <p className="eyebrow">Join today’s voyage</p>
          <h2>Student check-in</h2>
          <p className="support-copy">Enter the information your teacher gave you.</p>
        </div>
        <label>
          First name
          <input
            autoComplete="given-name"
            value={identity.firstName}
            onChange={(event) => setIdentity({ ...identity, firstName: event.target.value })}
            required
          />
        </label>
        <label>
          Last name
          <input
            autoComplete="family-name"
            value={identity.lastName}
            onChange={(event) => setIdentity({ ...identity, lastName: event.target.value })}
            required
          />
        </label>
        <label>
          Class period
          <select
            value={identity.classPeriod}
            onChange={(event) => setIdentity({ ...identity, classPeriod: event.target.value })}
            required
          >
            <option value="">Choose a period</option>
            {PERIODS.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </label>
        <label>
          Teacher session code
          <input
            className="session-code"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            maxLength={6}
            value={identity.sessionCode}
            onChange={(event) => setIdentity({ ...identity, sessionCode: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
            placeholder={demoMode ? 'Optional in demo' : 'ABC234'}
            required={!demoMode}
          />
        </label>
        {error && <div className="notice error" role="alert">{error}</div>}
        {demoMode && (
          <div className="notice demo" role="status">
            Demo mode: teacher saving is not connected. Results stay on this iPad.
          </div>
        )}
        <button type="submit" className="primary-button" disabled={joining}>
          {joining ? 'Joining…' : 'Join voyage'}
        </button>
      </form>
    </main>
  )
}
