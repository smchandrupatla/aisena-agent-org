import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'

function renderWithRouter(initialEntry: { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  it('renders the default projects heading and a link to create a project', () => {
    renderWithRouter({ pathname: '/' })
    expect(screen.getByRole('heading', { name: 'Your projects' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute('href', '/create')
  })

  it('shows a toast message passed via navigation state and auto-dismisses it', async () => {
    renderWithRouter({ pathname: '/', state: { toast: 'Project created successfully' } })
    expect(screen.getByText('Project created successfully')).toBeInTheDocument()
  })

  it('does not render a toast when no navigation state is provided', () => {
    renderWithRouter({ pathname: '/' })
    expect(screen.queryByText(/successfully/i)).not.toBeInTheDocument()
  })
})
