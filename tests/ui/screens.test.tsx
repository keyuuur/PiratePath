import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildGameContent } from '../../src/app/contentAdapter'
import { DEMO_PUBLIC_MANIFEST } from '../../src/app/demoContent'
import { JoinScreen } from '../../src/ui/JoinScreen'
import { ReviewScreen } from '../../src/ui/ReviewScreen'

describe('student screens', () => {
  it('allows a safe demo join without a classroom code', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    render(<JoinScreen joining={false} error="" demoMode onJoin={onJoin} />)
    await user.type(screen.getByLabelText('First name'), 'Ada')
    await user.type(screen.getByLabelText('Last name'), 'Lovelace')
    await user.selectOptions(screen.getByLabelText('Class period'), '2nd hour')
    await user.click(screen.getByRole('button', { name: 'Join voyage' }))
    expect(onJoin).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Ada', lastName: 'Lovelace', classPeriod: '2nd hour', sessionCode: '',
    }))
  })

  it('shows incomplete state without leaking correctness before submission', () => {
    const content = buildGameContent('screen-test', DEMO_PUBLIC_MANIFEST)
    render(
      <ReviewScreen
        missions={content.assessmentMissions}
        responses={{}}
        probes={content.rapidProbes}
        probeResponses={{}}
        incompleteMissionIds={['A1', 'A2', 'A3', 'A4', 'A5']}
        probesComplete={false}
        locked={false}
        submitting={false}
        error=""
        onEditMission={vi.fn()}
        onEditProbes={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Final Submit' })).toBeDisabled()
    expect(screen.queryByText(/correct measurements/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^correct$/i)).not.toBeInTheDocument()
  })
})
