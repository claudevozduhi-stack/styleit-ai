import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { MeasurementsPage } from './MeasurementsPage'

/** Рендерит страницу мерок внутри роутера (на ней есть ссылка на следующий шаг). */
function renderPage() {
  render(
    <MemoryRouter>
      <MeasurementsPage />
    </MemoryRouter>,
  )
}

const field = (label: string) => screen.getByLabelText(new RegExp(label)) as HTMLInputElement

describe('MeasurementsPage: быстрый выбор размера', () => {
  beforeEach(() => localStorage.clear())

  it('заполняет обхваты серединами диапазона и показывает диапазон', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^M RU/ }))

    expect(field('Обхват груди').value).toBe('92')
    expect(field('Обхват талии').value).toBe('73')
    expect(field('Обхват бёдер').value).toBe('97')
    expect(screen.getByText('Для M обычно 90–94 см')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^M RU/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('пересчитывает значения при смене фигуры и не трогает рост', () => {
    renderPage()
    fireEvent.change(field('Рост'), { target: { value: '180' } })
    fireEvent.click(screen.getByRole('button', { name: /^L RU/ }))
    fireEvent.click(screen.getByLabelText('Мужская'))

    expect(field('Обхват груди').value).toBe('105')
    expect(field('Рост').value).toBe('180')
    expect(screen.getByRole('button', { name: /^L RU/ })).toHaveTextContent('RU 50')
  })

  it('позволяет поправить подставленное значение вручную', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^S RU/ }))
    fireEvent.change(field('Обхват талии'), { target: { value: '70' } })

    expect(field('Обхват талии').value).toBe('70')
  })
})
