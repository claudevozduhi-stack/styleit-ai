import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { saveCapsule } from '../storage/localStore'
import { capsule } from '../tests/fixtures'
import { CapsulePage } from './CapsulePage'

describe('CapsulePage', () => {
  beforeEach(() => window.localStorage.clear())

  it('предлагает собрать капсулу, если её нет', () => {
    render(
      <MemoryRouter>
        <CapsulePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Капсулы пока нет/)).toBeInTheDocument()
  })

  it('показывает образы, размер, смету и ссылку на магазин', () => {
    saveCapsule(capsule)
    render(
      <MemoryRouter>
        <CapsulePage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Футболка базовая')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
    expect(screen.getByText(/2 вещей/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /В магазин/ })).toHaveAttribute(
      'href',
      'https://example.com/p/1',
    )
    expect(screen.getByRole('link', { name: /Примерить в 3D/ })).toHaveAttribute(
      'href',
      '/fitting/1',
    )
  })
})
