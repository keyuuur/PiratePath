import type { MissionDefinition, SubmissionResult } from '../app/types'
import { RouteGame } from '../game/RouteGame'
import { describeRoute } from '../game/routeMath'

interface ResultsScreenProps {
  result: SubmissionResult
  studentName: string
  demoMode: boolean
  missions: MissionDefinition[]
}

const TIER_LABELS = ['Foundation building', 'Developing navigator', 'Approaching mastery', 'Proficient navigator', 'Mastered navigator']

export function ResultsScreen({ result, studentName, demoMode, missions }: ResultsScreenProps) {
  return (
    <main className="results-screen" aria-labelledby="results-title">
      <section className="result-hero">
        <div className="result-badge" aria-hidden="true">{result.masteryTier}</div>
        <p className="eyebrow">Voyage submitted</p>
        <h1 id="results-title">Nice work, {studentName}.</h1>
        <p>Your Pirate Path mastery result is ready.</p>
      </section>
      <div className="result-grid">
        <article className="score-card"><span>Score</span><strong>{result.score === null ? 'Preview only' : `${result.score} / ${result.maxScore}`}</strong><p>{result.percent === null ? 'Not scored' : `${result.percent}%`}</p></article>
        <article className="score-card"><span>Mastery tier</span><strong>{result.masteryTier ?? '—'}</strong><p>{result.masteryTier === null ? 'Available in a class session' : TIER_LABELS[result.masteryTier - 1]}</p></article>
        <article className="score-card"><span>Focus skill</span><strong className="focus-label">{result.focus}</strong><p>Use the mission review below.</p></article>
      </div>
      <section className="answer-review" aria-labelledby="answer-review-title">
        <h2 id="answer-review-title">Mission review</h2>
        <p className="support-copy">Red follows the traveled route. The dashed blue arrow connects start to finish.</p>
        <div className="result-review-list">
          {missions.map((mission) => {
            const correct = result.responseStatus[mission.id]
            const review = result.review[mission.id]
            return (
              <article key={mission.id} className="result-review-row">
                <span className={correct ? 'review-chip correct' : 'review-chip review'}>{mission.id}: {correct ? 'Correct' : 'Review'}</span>
                <strong>{mission.title}</strong>
                <p>{!review
                  ? 'Review this mission with your teacher.'
                  : mission.mode === 'fixed'
                    ? `Correct measurements: ${review.distance} m distance; ${review.magnitude} m ${review.direction}.`
                    : `Routes can vary. Finish with ${review.magnitude} m ${review.direction} displacement and satisfy the map rule.`}</p>
                {mission.mode === 'fixed' && (
                  <div className="result-route-map">
                    <RouteGame
                      mission={mission}
                      reducedMotion
                      onRouteChange={() => undefined}
                      onPlaybackComplete={() => undefined}
                      onPlaybackProgress={() => undefined}
                    />
                    <p className="sr-only">{describeRoute(mission.route.points)}</p>
                  </div>
                )}
              </article>
            )
          })}
          <div className="probe-result-row">
            {(['C1', 'C2', 'C3'] as const).map((id) => (
              <span key={id} className={result.responseStatus[id] ? 'review-chip correct' : 'review-chip review'}>
                {id}: {result.responseStatus[id] ? 'Correct' : 'Review'}
              </span>
            ))}
          </div>
        </div>
      </section>
      <div className={demoMode ? 'notice demo' : 'notice success'} role="status">
        {demoMode ? 'Demo complete. These results were not sent to a teacher.' : 'Results saved for your teacher. You may close this tab.'}
      </div>
    </main>
  )
}
