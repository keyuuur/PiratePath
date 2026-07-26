import type { MissionDefinition, NumberDirectionResponse, ProbeDefinition } from '../app/types'

interface ReviewScreenProps {
  missions: MissionDefinition[]
  responses: Record<string, NumberDirectionResponse>
  probes: ProbeDefinition[]
  probeResponses: Record<string, string>
  incompleteMissionIds: string[]
  probesComplete: boolean
  locked: boolean
  submitting: boolean
  error: string
  onEditMission: (index: number) => void
  onEditProbes: () => void
  onSubmit: () => void
}

export function ReviewScreen({
  missions,
  responses,
  probes,
  probeResponses,
  incompleteMissionIds,
  probesComplete,
  locked,
  submitting,
  error,
  onEditMission,
  onEditProbes,
  onSubmit,
}: ReviewScreenProps) {
  return (
    <main className="review-screen" aria-labelledby="review-title">
      <section className="mission-prompt compact">
        <div>
          <p className="eyebrow">Response review</p>
          <h1 id="review-title">Check before final submission.</h1>
          <p>{locked ? 'Your responses are locked while submission is retried.' : 'Complete any highlighted response. No correctness is shown yet.'}</p>
        </div>
      </section>
      <div className="review-list">
        {missions.map((mission, index) => {
          const response = responses[mission.id]
          const incomplete = incompleteMissionIds.includes(mission.id)
          return (
            <article className={incomplete ? 'review-row incomplete' : 'review-row'} key={mission.id}>
              <div><span>{mission.id}</span><strong>{mission.title}</strong></div>
              <p>{response?.distance || '—'} m distance · {response?.magnitude || '—'} m {response?.direction || '—'}</p>
              <button type="button" onClick={() => onEditMission(index)} disabled={locked}>{incomplete ? 'Complete' : 'Edit'}</button>
            </article>
          )
        })}
        <article className={probesComplete ? 'review-row' : 'review-row incomplete'}>
          <div><span>C1–C3</span><strong>Rapid check</strong></div>
          <p>{probes.filter((probe) => probeResponses[probe.id]).length} of 3 responses saved</p>
          <button type="button" onClick={onEditProbes} disabled={locked}>{probesComplete ? 'Edit' : 'Complete'}</button>
        </article>
      </div>
      <div className="final-submit-card">
        <div>
          <h2>Final Submit locks this scored attempt.</h2>
          <p>You will not be able to change these answers afterward.</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={onSubmit}
          disabled={submitting || incompleteMissionIds.length > 0 || !probesComplete}
        >
          {submitting ? 'Submitting…' : locked ? 'Retry Final Submit' : 'Final Submit'}
        </button>
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
    </main>
  )
}
