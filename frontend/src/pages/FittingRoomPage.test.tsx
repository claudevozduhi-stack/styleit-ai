import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { saveCapsule, saveMeasurements } from '../storage/localStore'
import { capsule } from '../tests/fixtures'
import type { SizeOption, SizeRecommendation } from '../types/analysis'
import { FittingRoomPage } from './FittingRoomPage'

// В jsdom нет WebGL, поэтому 3D-сцену подменяем: проверяем, какой размер и режим ей передан.
vi.mock('../features/fitting/FittingScene', () => ({
  default: ({ option, colorMode }: { option: SizeOption; colorMode: string }) => (
    <div data-testid="scene">
      {option.size_label}:{colorMode}
    </div>
  ),
}))

const sizeOption = (label: string, fit: 'good' | 'loose'): SizeOption => ({
  size_label: label,
  size_order: label === 'S' ? 1 : 2,
  score: 0,
  zones: [
    { zone: 'chest', body_cm: 90, size_min_cm: 86, size_max_cm: 92, excess_cm: 0, fit },
    { zone: 'waist', body_cm: 72, size_min_cm: 70, size_max_cm: 76, excess_cm: 0, fit },
  ],
})

const recommendation: SizeRecommendation = {
  product_id: 1,
  recommended: sizeOption('S', 'good'),
  confidence: 'high',
  note: 'Размер S подходит по всем меркам.',
  options: [sizeOption('S', 'good'), sizeOption('M', 'loose')],
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/fitting/:productId" element={<FittingRoomPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FittingRoomPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    saveMeasurements({
      gender: 'female',
      heightCm: 168,
      weightKg: 60,
      chestCm: 90,
      waistCm: 72,
      hipsCm: 96,
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('без вещи в капсуле предлагает вернуться к капсуле', () => {
    renderAt('/fitting/1')
    expect(screen.getByText(/нет в вашей капсуле/)).toBeInTheDocument()
  })

  it('показывает рекомендованный размер и даёт сравнить соседний', async () => {
    saveCapsule(capsule)
    const spy = vi.spyOn(api, 'recommendSize').mockResolvedValue(recommendation)
    renderAt('/fitting/1')

    expect(await screen.findByTestId('scene')).toHaveTextContent('S:fit')
    expect(spy).toHaveBeenCalledWith(1, expect.objectContaining({ chestCm: 90 }))
    expect(screen.getAllByText('в самый раз')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'M' }))
    expect(screen.getByTestId('scene')).toHaveTextContent('M:fit')
    expect(screen.getAllByText('свободно')).toHaveLength(2)

    fireEvent.click(screen.getByLabelText('Показать посадку цветом'))
    expect(screen.getByTestId('scene')).toHaveTextContent('M:product')
  })

  it('показывает ошибку сервера', async () => {
    saveCapsule(capsule)
    vi.spyOn(api, 'recommendSize').mockRejectedValue(new Error('Нет размерной сетки'))
    renderAt('/fitting/1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет размерной сетки')
  })
})
