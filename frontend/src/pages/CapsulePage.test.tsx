import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { saveCapsule } from '../storage/localStore'
import { capsule, outfitCapsule } from '../tests/fixtures'
import { CapsulePage } from './CapsulePage'

function renderPage() {
  return render(
    <MemoryRouter>
      <CapsulePage />
    </MemoryRouter>,
  )
}

describe('CapsulePage', () => {
  beforeEach(() => window.localStorage.clear())

  it('предлагает собрать капсулу, если её нет', () => {
    renderPage()
    expect(screen.getByText(/Капсулы пока нет/)).toBeInTheDocument()
  })

  it('показывает вещи, размер, смету и ссылку на магазин', () => {
    saveCapsule(capsule)
    renderPage()
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

  it('под вещами показывает лучшие образы со ссылкой на весь образ', () => {
    saveCapsule(outfitCapsule)
    renderPage()
    const best = screen.getByRole('region', { name: 'Лучшие образы' })
    const links = within(best).getAllByRole('link')
    // Футболка × (джинсы, юбка) × (без куртки, с курткой) = 4 сочетания.
    expect(links).toHaveLength(4)
    expect(within(best).getByRole('link', { name: 'Открыть образ «Город»' })).toHaveAttribute(
      'href',
      '/looks/1-2',
    )
    // Вещи капсулы показаны по одному разу, хотя футболка входит в оба образа стилиста.
    const items = screen.getByRole('region', { name: 'Вещи капсулы' })
    expect(within(items).getAllByText('Футболка базовая')).toHaveLength(1)
  })
})
