// Тесты натяжения ткани и предупреждения о тесном размере.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Fit, SizeOption } from '../../types/analysis'
import { strainedColor } from '../avatar/loftGrid'
import { buildBodyModel } from '../avatar/sections'
import { TightWarning } from './FitPanel'
import { STRAIN_FULL_CM, strainAt, tightWarning, zoneStrains } from './strain'

/** Размер, сдвинутый от мерок на shiftCm во всех зонах. */
function option(label: string, order: number, shiftCm: number, fit: Fit): SizeOption {
  const zone = (name: 'chest' | 'waist' | 'hips', bodyCm: number) => ({
    zone: name,
    body_cm: bodyCm,
    size_min_cm: bodyCm + shiftCm - 3,
    size_max_cm: bodyCm + shiftCm + 3,
    excess_cm: 0,
    fit,
  })
  return {
    size_label: label,
    size_order: order,
    score: 0,
    zones: [zone('chest', 92), zone('waist', 72), zone('hips', 98)],
  }
}

const options = [
  option('XS', 1, -12, 'tight'),
  option('S', 2, -6, 'tight'),
  option('M', 3, 0, 'good'),
  option('L', 4, 6, 'loose'),
]
const landmarks = buildBodyModel({
  gender: 'female',
  heightCm: 168,
  weightKg: 60,
  chestCm: 92,
  waistCm: 72,
  hipsCm: 98,
}).landmarks

describe('натяжение ткани', () => {
  it('у подходящего размера натяжения нет, у тесного растёт с нехваткой обхвата', () => {
    expect(
      zoneStrains(options[2] as SizeOption, landmarks).every((zone) => zone.strain === 0),
    ).toBe(true)
    const xs = zoneStrains(options[0] as SizeOption, landmarks)
    expect(xs[0]?.strain).toBeCloseTo(Math.min(9 / STRAIN_FULL_CM, 1))
    const s = zoneStrains(options[1] as SizeOption, landmarks)
    expect(s[0]?.strain).toBeCloseTo(Math.max(3 / STRAIN_FULL_CM, 0.25))
  })

  it('между зонами натяжение меняется плавно', () => {
    const strains = [
      { y: 100, strain: 0 },
      { y: 120, strain: 1 },
    ]
    expect(strainAt(strains, 110)).toBeCloseTo(0.5)
    expect(strainAt(strains, 90)).toBe(0)
    expect(strainAt([], 110)).toBe(0)
  })

  it('натянутая ткань светлее, но не ярче белого', () => {
    const color = [0.2, 0.3, 0.4] as const
    const strained = strainedColor(color, 1, 10)
    strained.forEach((channel, index) => {
      expect(channel).toBeGreaterThan(color[index] as number)
      expect(channel).toBeLessThanOrEqual(1)
    })
    expect(strainedColor(color, 0, 10)).toEqual([...color])
  })
})

describe('предупреждение о тесном размере', () => {
  it('называет зоны, нехватку и ближайший подходящий размер', () => {
    const text = tightWarning(options[0] as SizeOption, options)
    expect(text).toContain('Размер XS мал')
    expect(text).toContain('в груди не хватает 9 см')
    expect(text).toContain('лучше взять M')
  })

  it('для подходящего размера предупреждения нет', () => {
    expect(tightWarning(options[2] as SizeOption, options)).toBeNull()
  })

  it('если большего подходящего размера нет, так и говорит', () => {
    const text = tightWarning(options[1] as SizeOption, options.slice(0, 2))
    expect(text).toContain('большего подходящего размера')
  })

  it('показывается рядом с выбором размера', () => {
    render(<TightWarning selected={options[1] as SizeOption} options={options} />)
    expect(screen.getByRole('status')).toHaveTextContent('Размер S мал для ваших мерок')
  })
})
