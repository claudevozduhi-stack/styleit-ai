import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { saveCapsule, saveMeasurements } from '../storage/localStore'
import { outfitCapsule } from '../tests/fixtures'
import type { SizeOption, SizeRecommendation } from '../types/analysis'
import type { Category } from '../types/catalog'
import { LookPage } from './LookPage'

// В jsdom нет WebGL: проверяем, какие вещи, в каком порядке и размере переданы сцене.
vi.mock('../features/fitting/FittingScene', () => ({
  default: ({
    garments,
    colorMode,
  }: {
    garments: { category: Category; option: SizeOption }[]
    colorMode: string
  }) => (
    <div data-testid="scene">
      {garments.map((garment) => `${garment.category}-${garment.option.size_label}`).join(',')}:
      {colorMode}
    </div>
  ),
}))

const sizeOption = (label: string): SizeOption => ({
  size_label: label,
  size_order: label === 'S' ? 1 : 2,
  score: 0,
  zones: [
    { zone: 'waist', body_cm: 72, size_min_cm: 70, size_max_cm: 76, excess_cm: 0, fit: 'good' },
  ],
})

const recommendation = (productId: number): SizeRecommendation => ({
  product_id: productId,
  recommended: sizeOption('S'),
  confidence: 'high',
  note: 'Подходит.',
  options: [sizeOption('S'), sizeOption('M')],
})

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/looks/:outfitId" element={<LookPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LookPage', () => {
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

  it('неизвестный образ предлагает вернуться к капсуле', () => {
    saveCapsule(outfitCapsule)
    renderAt('/looks/99')
    expect(screen.getByText(/Такого образа нет/)).toBeInTheDocument()
  })

  it('надевает все вещи образа слоями и даёт сменить размер одной вещи', async () => {
    saveCapsule(outfitCapsule)
    const spy = vi
      .spyOn(api, 'recommendSize')
      .mockImplementation((productId) => Promise.resolve(recommendation(productId)))
    renderAt('/looks/1-2-4')

    const scene = await screen.findByTestId('scene')
    expect(scene).toHaveTextContent('jeans-S,tshirt-S,jacket-S:product')
    expect(spy).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('heading', { name: 'Футболка, джинсы и куртка' })).toBeInTheDocument()

    const jacketSizes = screen.getByRole('group', { name: 'Размер: Куртка лёгкая' })
    fireEvent.click(jacketSizes.querySelector('button:nth-child(2)') as HTMLButtonElement)
    expect(screen.getByTestId('scene')).toHaveTextContent('jeans-S,tshirt-S,jacket-M')

    fireEvent.click(screen.getByLabelText('Показать посадку цветом'))
    expect(screen.getByTestId('scene')).toHaveTextContent(':fit')
  })

  it('показывает ошибку подбора размера', async () => {
    saveCapsule(outfitCapsule)
    vi.spyOn(api, 'recommendSize').mockRejectedValue(new Error('Нет размерной сетки'))
    renderAt('/looks/1-2')
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет размерной сетки')
  })
})
