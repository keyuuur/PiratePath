import { describe, expect, it } from 'vitest'
import { buildGameContent, buildMissionResponses, demoCompletionResult } from '../../src/app/contentAdapter'
import { DEMO_PUBLIC_MANIFEST } from '../../src/app/demoContent'

describe('student content adapter', () => {
  it('uses the approved mission order without assessment answer keys', () => {
    const content = buildGameContent('ui-test', DEMO_PUBLIC_MANIFEST)
    expect(content.guidedMissions.map((mission) => mission.id)).toEqual(['P1', 'P2', 'P3'])
    expect(content.assessmentMissions.map((mission) => mission.id)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5'])
    expect(content.assessmentMissions.every((mission) => !('answer' in mission))).toBe(true)
    expect(content.rapidProbes.map((probe) => probe.id)).toEqual(['C1', 'C2', 'C3'])
    expect(content.rapidProbes.every((probe) => !('correctValue' in probe))).toBe(true)
    expect(JSON.stringify(content.publicManifest)).not.toContain('correctOptionId')
    expect(JSON.stringify(content.publicManifest)).not.toContain('explanation')
  })

  it('builds neutral raw responses from only the public variant manifest', () => {
    const responses = buildMissionResponses(DEMO_PUBLIC_MANIFEST, {}, {}, {})
    expect(responses).toHaveLength(8)
    expect(responses.find((response) => response.missionId === 'A1')).toMatchObject({
      kind: 'MEASUREMENT',
      distance: null,
      displacementMagnitude: null,
      displacementDirection: null,
    })
    expect(responses.find((response) => response.missionId === 'C1')).toMatchObject({
      kind: 'CONCEPT',
      selectedOptionId: null,
    })
  })

  it('marks demo completion as explicitly unscored', () => {
    expect(demoCompletionResult(DEMO_PUBLIC_MANIFEST)).toMatchObject({
      score: null,
      percent: null,
      masteryTier: null,
      review: { A1: expect.objectContaining({ direction: expect.any(String) }) },
    })
  })
})
