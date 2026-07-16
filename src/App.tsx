import { lazy, Suspense, useEffect, useMemo, useReducer, useState } from 'react'
import './App.css'
import {
  startLiveAttempt,
  submitLiveAttempt,
  syncLiveCheckpoint,
  type AttemptRuntime,
} from './app/apiClient'
import {
  buildGameContent,
  buildMissionResponses,
  demoCompletionResult,
  practiceIsCorrect,
} from './app/contentAdapter'
import { DEMO_PUBLIC_MANIFEST } from './app/demoContent'
import type {
  AppScreen,
  CheckpointState,
  GridPoint,
  NumberDirectionResponse,
  StudentIdentity,
  SubmissionResult,
} from './app/types'
import { samePoint } from './game/routeMath'
import {
  checkpointKey,
  clearCheckpoint,
  clearExpiredCheckpoints,
  loadCheckpoint,
  saveCheckpoint,
} from './persistence/checkpoint'
import { BriefingScreen } from './ui/BriefingScreen'
import { JoinScreen } from './ui/JoinScreen'
import { ProgressHeader } from './ui/ProgressHeader'
import { RapidCheckScreen } from './ui/RapidCheckScreen'
import { ReadinessScreen } from './ui/ReadinessScreen'
import { ReviewScreen } from './ui/ReviewScreen'
import { SettingsBar } from './ui/SettingsBar'

const MissionScreen = lazy(() => import('./ui/MissionScreen').then((module) => ({ default: module.MissionScreen })))
const ResultsScreen = lazy(() => import('./ui/ResultsScreen').then((module) => ({ default: module.ResultsScreen })))

const EMPTY_RESPONSE: NumberDirectionResponse = { distance: '', magnitude: '', direction: '' }
const DEMO_MODE = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true'

interface AppState {
  screen: AppScreen
  firstName: string
  runtime: AttemptRuntime | null
  storageKey: string
  practiceIndex: number
  assessmentIndex: number
  practiceResponses: Record<string, NumberDirectionResponse>
  assessmentResponses: Record<string, NumberDirectionResponse>
  probeResponses: Record<string, string>
  savedRoutes: Record<string, GridPoint[]>
  practiceAttempts: number
  practiceFeedback: '' | 'correct' | 'retry'
  reducedMotion: boolean
  muted: boolean
  startedAt: string
  result?: SubmissionResult
  returnToReview: boolean
  submissionLocked: boolean
  saved: boolean
  error: string
}

type AppAction =
  | { type: 'PATCH'; value: Partial<AppState> }
  | { type: 'SET_RESPONSE'; practice: boolean; missionId: string; value: NumberDirectionResponse }
  | { type: 'SET_PROBE'; probeId: string; value: string }
  | { type: 'SET_ROUTE'; missionId: string; points: GridPoint[] }

function initialState(): AppState {
  return {
    screen: 'join',
    firstName: '',
    runtime: null,
    storageKey: '',
    practiceIndex: 0,
    assessmentIndex: 0,
    practiceResponses: {},
    assessmentResponses: {},
    probeResponses: {},
    savedRoutes: {},
    practiceAttempts: 0,
    practiceFeedback: '',
    reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    muted: true,
    startedAt: new Date().toISOString(),
    returnToReview: false,
    submissionLocked: false,
    saved: true,
    error: '',
  }
}

function reducer(state: AppState, action: AppAction): AppState {
  if (action.type === 'PATCH') return { ...state, ...action.value }
  if (action.type === 'SET_RESPONSE') {
    const key = action.practice ? 'practiceResponses' : 'assessmentResponses'
    return { ...state, [key]: { ...state[key], [action.missionId]: action.value }, saved: false, error: '' }
  }
  if (action.type === 'SET_PROBE') {
    return { ...state, probeResponses: { ...state.probeResponses, [action.probeId]: action.value }, saved: false, error: '' }
  }
  return { ...state, savedRoutes: { ...state.savedRoutes, [action.missionId]: action.points }, saved: false, error: '' }
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000001'
}

function checkpointFromState(state: AppState): CheckpointState | null {
  if (!state.runtime) return null
  return {
    version: 2,
    screen: state.screen === 'submitting' || state.screen === 'join' ? 'briefing' : state.screen,
    practiceIndex: state.practiceIndex,
    assessmentIndex: state.assessmentIndex,
    practiceResponses: state.practiceResponses,
    assessmentResponses: state.assessmentResponses,
    probeResponses: state.probeResponses,
    savedRoutes: state.savedRoutes,
    reducedMotion: state.reducedMotion,
    muted: state.muted,
    startedAt: state.startedAt,
    attemptId: state.runtime.attemptId,
    attemptToken: state.runtime.attemptToken,
    practiceSeed: state.runtime.practiceSeed,
    contentVersion: state.runtime.contentVersion,
    mode: state.runtime.mode,
    publicManifest: state.runtime.publicManifest,
    submissionLocked: state.submissionLocked,
    finalResult: state.result,
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [joining, setJoining] = useState(false)
  const practiceSeed = state.runtime?.practiceSeed ?? 'pirate-path-preview'
  const publicManifest = state.runtime?.publicManifest ?? DEMO_PUBLIC_MANIFEST
  const content = useMemo(() => buildGameContent(practiceSeed, publicManifest), [practiceSeed, publicManifest])

  useEffect(() => {
    clearExpiredCheckpoints()
  }, [])

  useEffect(() => {
    if (!state.storageKey || !state.runtime || state.screen === 'join' || state.screen === 'results') return
    const checkpoint = checkpointFromState(state)
    if (!checkpoint) return
    saveCheckpoint(state.storageKey, checkpoint)
    if (!state.saved) dispatch({ type: 'PATCH', value: { saved: true } })
  }, [state])

  async function join(identity: StudentIdentity): Promise<void> {
    dispatch({ type: 'PATCH', value: { error: '' } })
    if (!identity.firstName.trim() || !identity.lastName.trim() || !identity.classPeriod) {
      dispatch({ type: 'PATCH', value: { error: 'Enter your name and choose your class period.' } })
      return
    }
    if (!DEMO_MODE && !/^[A-HJ-NP-Z2-9]{6}$/.test(identity.sessionCode.trim().toUpperCase())) {
      dispatch({ type: 'PATCH', value: { error: 'Enter the 6-character session code from your teacher.' } })
      return
    }

    setJoining(true)
    try {
      const storageKey = await checkpointKey(identity)
      const saved = loadCheckpoint(storageKey)
      let runtime: AttemptRuntime
      if (saved && saved.mode === (DEMO_MODE ? 'demo' : 'live')) {
        runtime = {
          attemptId: saved.attemptId,
          attemptToken: saved.attemptToken,
          practiceSeed: saved.practiceSeed,
          contentVersion: saved.contentVersion,
          startedAt: saved.startedAt,
          mode: saved.mode,
          publicManifest: saved.publicManifest,
        }
      } else if (DEMO_MODE) {
        const attemptId = randomId()
        runtime = {
          attemptId,
          attemptToken: '',
          practiceSeed: attemptId,
          contentVersion: 'pirate-path-v2-demo-public',
          startedAt: new Date().toISOString(),
          mode: 'demo',
          publicManifest: DEMO_PUBLIC_MANIFEST,
        }
      } else {
        runtime = await startLiveAttempt({
          code: identity.sessionCode.trim().toUpperCase(),
          firstName: identity.firstName,
          lastName: identity.lastName,
          classPeriod: identity.classPeriod,
          clientAttemptId: randomId(),
        })
      }

      dispatch({
        type: 'PATCH',
        value: {
          ...(saved ? {
            screen: saved.screen,
            practiceIndex: saved.practiceIndex,
            assessmentIndex: saved.assessmentIndex,
            practiceResponses: saved.practiceResponses,
            assessmentResponses: saved.assessmentResponses,
            probeResponses: saved.probeResponses,
            savedRoutes: saved.savedRoutes,
            reducedMotion: saved.reducedMotion,
            muted: saved.muted,
            startedAt: saved.startedAt,
            result: saved.finalResult,
            submissionLocked: saved.submissionLocked,
          } : { screen: 'briefing', startedAt: runtime.startedAt }),
          firstName: identity.firstName.trim(),
          runtime,
          storageKey,
          saved: true,
          error: '',
        },
      })
    } catch (error) {
      dispatch({ type: 'PATCH', value: { error: error instanceof Error ? error.message : 'Unable to join this voyage.' } })
    } finally {
      setJoining(false)
    }
  }

  function currentMissionId(): string {
    if (state.screen === 'practice') return content.guidedMissions[state.practiceIndex]?.id ?? 'P1'
    if (state.screen === 'assessment') return content.assessmentMissions[state.assessmentIndex]?.id ?? 'A1'
    if (state.screen === 'rapid' || state.screen === 'review') return 'C1'
    return 'P1'
  }

  function checkpointLive(): void {
    if (state.runtime?.mode !== 'live') return
    const responses = buildMissionResponses(
      content.publicManifest,
      state.assessmentResponses,
      state.probeResponses,
      state.savedRoutes,
    )
    void syncLiveCheckpoint(state.runtime, {
      currentMissionId: currentMissionId(),
      completedMissionIds: [],
      responses,
    }).catch(() => undefined)
  }

  function checkPractice(vectorPlaced: boolean): void {
    const mission = content.guidedMissions[state.practiceIndex]
    if (!mission) return
    const response = state.practiceResponses[mission.id] ?? EMPTY_RESPONSE
    const points = state.savedRoutes[mission.id] ?? mission.route.points
    const attempts = state.practiceAttempts + 1
    const vectorReady = mission.id !== 'P2' || vectorPlaced
    const correct = vectorReady && practiceIsCorrect(mission, response, points)
    dispatch({
      type: 'PATCH',
      value: {
        practiceAttempts: attempts,
        practiceFeedback: correct ? 'correct' : 'retry',
        error: !vectorReady
          ? 'Place the vector from START to FINISH before checking.'
          : !response.distance || !response.magnitude || !response.direction
          ? 'Complete all three measurements before checking.'
          : '',
      },
    })
  }

  function continuePractice(): void {
    if (state.practiceIndex === content.guidedMissions.length - 1) {
      dispatch({ type: 'PATCH', value: { screen: 'readiness', practiceFeedback: '', saved: false } })
    } else {
      dispatch({
        type: 'PATCH',
        value: {
          practiceIndex: state.practiceIndex + 1,
          practiceAttempts: 0,
          practiceFeedback: '',
          error: '',
          saved: false,
        },
      })
    }
  }

  function continueAssessment(): void {
    checkpointLive()
    if (state.returnToReview) {
      dispatch({ type: 'PATCH', value: { screen: 'review', returnToReview: false, saved: false } })
    } else if (state.assessmentIndex === content.assessmentMissions.length - 1) {
      dispatch({ type: 'PATCH', value: { screen: 'rapid', saved: false } })
    } else {
      dispatch({ type: 'PATCH', value: { assessmentIndex: state.assessmentIndex + 1, saved: false } })
    }
  }

  function responseComplete(missionId: string): boolean {
    const response = state.assessmentResponses[missionId]
    const mission = content.assessmentMissions.find((item) => item.id === missionId)
    if (!response?.distance || !response.magnitude || !response.direction || !mission) return false
    if (mission.mode === 'fixed') return true
    const points = state.savedRoutes[missionId] ?? [mission.route.start]
    return points.length > 1 && samePoint(points.at(-1)!, mission.route.target)
  }

  const incompleteMissionIds = content.assessmentMissions
    .filter((mission) => !responseComplete(mission.id))
    .map((mission) => mission.id)
  const probesComplete = content.rapidProbes.every((probe) => Boolean(state.probeResponses[probe.id]))

  async function submit(): Promise<void> {
    if (incompleteMissionIds.length || !probesComplete) {
      dispatch({ type: 'PATCH', value: { error: 'Complete every highlighted response before final submission.' } })
      return
    }
    if (!state.runtime) return
    dispatch({ type: 'PATCH', value: { screen: 'submitting', submissionLocked: true, error: '' } })
    const responses = buildMissionResponses(
      content.publicManifest,
      state.assessmentResponses,
      state.probeResponses,
      state.savedRoutes,
    )
    try {
      let result: SubmissionResult
      if (state.runtime.mode === 'demo') {
        result = demoCompletionResult(content.publicManifest)
      } else {
        const live = await submitLiveAttempt(state.runtime, responses)
        const responseStatus = Object.fromEntries(
          live.itemResults.map((item) => [item.missionId, item.earned === item.possible]),
        )
        result = {
          score: live.score,
          maxScore: 20,
          percent: live.percent,
          masteryTier: live.masteryTier,
          focus: live.misconceptions.length ? 'Review the highlighted mission skills' : 'Keep comparing path and position',
          responseStatus,
          review: live.review,
        }
      }
      clearCheckpoint(state.storageKey)
      dispatch({ type: 'PATCH', value: { screen: 'results', result, saved: true } })
    } catch (error) {
      dispatch({
        type: 'PATCH',
        value: {
          screen: 'review',
          error: `${error instanceof Error ? error.message : 'Submission did not finish.'} Your answers are locked and safe on this iPad. Try Final Submit again.`,
        },
      })
    }
  }

  const progress = (() => {
    if (state.screen === 'practice') return { label: 'Guided practice', step: `${state.practiceIndex + 1} of 3` }
    if (state.screen === 'assessment') return { label: 'Scored voyage', step: `${state.assessmentIndex + 1} of 5` }
    if (state.screen === 'rapid') return { label: 'Rapid check', step: '3 questions' }
    if (state.screen === 'review' || state.screen === 'submitting') return { label: 'Final review', step: 'Ready to submit' }
    return { label: 'Mission briefing', step: 'Practice then assessment' }
  })()

  let screen
  if (state.screen === 'join') {
    screen = <JoinScreen joining={joining} error={state.error} demoMode={DEMO_MODE} onJoin={join} />
  } else if (state.screen === 'briefing') {
    screen = <BriefingScreen onContinue={() => dispatch({ type: 'PATCH', value: { screen: 'practice', saved: false } })} />
  } else if (state.screen === 'practice') {
    const mission = content.guidedMissions[state.practiceIndex]
    screen = <MissionScreen
      key={mission.variantId}
      mission={mission}
      response={state.practiceResponses[mission.id] ?? EMPTY_RESPONSE}
      routePoints={state.savedRoutes[mission.id] ?? [mission.route.start]}
      reducedMotion={state.reducedMotion}
      practice
      practiceAttempts={state.practiceAttempts}
      feedback={state.practiceFeedback}
      error={state.error}
      returnToReview={false}
      onResponseChange={(value) => dispatch({ type: 'SET_RESPONSE', practice: true, missionId: mission.id, value })}
      onRouteChange={(points) => dispatch({ type: 'SET_ROUTE', missionId: mission.id, points })}
      onCheckPractice={checkPractice}
      onContinue={continuePractice}
    />
  } else if (state.screen === 'readiness') {
    screen = <ReadinessScreen onBegin={() => dispatch({ type: 'PATCH', value: { screen: 'assessment', saved: false } })} />
  } else if (state.screen === 'assessment') {
    const mission = content.assessmentMissions[state.assessmentIndex]
    screen = <MissionScreen
      key={mission.variantId}
      mission={mission}
      response={state.assessmentResponses[mission.id] ?? EMPTY_RESPONSE}
      routePoints={state.savedRoutes[mission.id] ?? [mission.route.start]}
      reducedMotion={state.reducedMotion}
      practice={false}
      practiceAttempts={0}
      feedback=""
      error={state.error}
      returnToReview={state.returnToReview}
      onResponseChange={(value) => dispatch({ type: 'SET_RESPONSE', practice: false, missionId: mission.id, value })}
      onRouteChange={(points) => dispatch({ type: 'SET_ROUTE', missionId: mission.id, points })}
      onCheckPractice={() => undefined}
      onContinue={continueAssessment}
    />
  } else if (state.screen === 'rapid') {
    screen = <RapidCheckScreen
      probes={content.rapidProbes}
      responses={state.probeResponses}
      error={state.error}
      returnToReview={state.returnToReview}
      onChange={(probeId, value) => dispatch({ type: 'SET_PROBE', probeId, value })}
      onContinue={() => {
        checkpointLive()
        dispatch({ type: 'PATCH', value: { screen: 'review', returnToReview: false, saved: false } })
      }}
    />
  } else if (state.screen === 'review' || state.screen === 'submitting') {
    screen = <ReviewScreen
      missions={content.assessmentMissions}
      responses={state.assessmentResponses}
      probes={content.rapidProbes}
      probeResponses={state.probeResponses}
      incompleteMissionIds={incompleteMissionIds}
      probesComplete={probesComplete}
      locked={state.submissionLocked}
      submitting={state.screen === 'submitting'}
      error={state.error}
      onEditMission={(index) => dispatch({ type: 'PATCH', value: { screen: 'assessment', assessmentIndex: index, returnToReview: true } })}
      onEditProbes={() => dispatch({ type: 'PATCH', value: { screen: 'rapid', returnToReview: true } })}
      onSubmit={submit}
    />
  } else {
    screen = state.result
      ? <ResultsScreen
          result={state.result}
          studentName={state.firstName}
          demoMode={state.runtime?.mode === 'demo'}
          missions={content.assessmentMissions}
        />
      : null
  }

  return (
    <div className="app-shell">
      {state.screen !== 'join' && state.screen !== 'results' && (
        <>
          <ProgressHeader label={progress.label} step={progress.step} saved={state.saved} />
          <SettingsBar
            muted={state.muted}
            reducedMotion={state.reducedMotion}
            onMutedChange={(muted) => dispatch({ type: 'PATCH', value: { muted, saved: false } })}
            onReducedMotionChange={(reducedMotion) => dispatch({ type: 'PATCH', value: { reducedMotion, saved: false } })}
          />
        </>
      )}
      <Suspense fallback={<main className="centered-screen" role="status"><div className="loading-card">Loading the route map…</div></main>}>
        {screen}
      </Suspense>
    </div>
  )
}

export default App
