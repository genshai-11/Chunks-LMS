import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffSignInForm } from './AuthProvider'

const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn() }))
vi.mock('./useStaffSession', () => ({
  useStaffSession: () => ({ signInWithPassword: mocks.signInWithPassword }),
}))

describe('StaffSignInForm', () => {
  beforeEach(() => {
    mocks.signInWithPassword.mockReset()
    mocks.signInWithPassword.mockResolvedValue({ ok: true })
  })

  it('accepts an email or username and forwards the identifier unchanged', async () => {
    const user = userEvent.setup()
    render(<StaffSignInForm />)

    const identifier = screen.getByLabelText('Email or username')
    expect(identifier).toHaveAttribute('type', 'text')

    await user.type(identifier, 'Teacher.One')
    await user.type(screen.getByLabelText('Password'), 'safe-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(mocks.signInWithPassword).toHaveBeenCalledWith('Teacher.One', 'safe-password')
    expect(await screen.findByText('Signed in successfully!')).toBeInTheDocument()
  })
})
