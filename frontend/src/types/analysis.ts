// Типы анализа фигуры, цветотипа, размера и капсулы — зеркало схем бэкенда.
import type { Product, Style } from './catalog'

export type BodyType = 'hourglass' | 'triangle' | 'inverted_triangle' | 'rectangle' | 'oval'
export type Confidence = 'high' | 'medium' | 'low'
export type Fit = 'loose' | 'good' | 'tight'
export type BodyZone = 'chest' | 'waist' | 'hips' | 'height'
export type Occasion = 'everyday' | 'work' | 'study' | 'date' | 'party' | 'travel'
export type Undertone = 'warm' | 'cool' | 'neutral'
export type ColorSeason = 'spring' | 'summer' | 'autumn' | 'winter'

/** Мерки в формате API бэкенда (snake_case). */
export interface MeasurementsApi {
  gender: 'female' | 'male'
  height_cm: number
  weight_kg: number
  chest_cm: number
  waist_cm: number
  hips_cm: number
  shoulders_cm?: number
  inseam_cm?: number
}

export interface ColorAnalysisRequest {
  undertone: Undertone
  skin_hex: string
  hair_hex: string
  eye_hex: string
}

export interface ColorAnalysis {
  season: ColorSeason
  title: string
  explanation: string
  palette_hex: string[]
  avoid_hex: string[]
}

export interface ZoneFit {
  zone: BodyZone
  body_cm: number
  size_min_cm: number
  size_max_cm: number
  excess_cm: number
  fit: Fit
}

export interface SizeOption {
  size_label: string
  size_order: number
  zones: ZoneFit[]
  score: number
}

export interface SizeRecommendation {
  product_id: number
  recommended: SizeOption
  confidence: Confidence
  note: string
  options: SizeOption[]
}

export interface CapsuleRequest {
  measurements: MeasurementsApi
  style: Style
  occasion: Occasion
  budget_kzt: number
  palette_hex: string[]
}

export interface LookItem {
  product: Product
  recommended_size: string
  size_confidence: Confidence
  size_note: string
}

export interface Look {
  title: string
  explanation: string
  items: LookItem[]
  total_kzt: number
}

export interface Estimate {
  items_count: number
  total_kzt: number
  budget_kzt: number
  remaining_kzt: number
  within_budget: boolean
}

export interface Capsule {
  body_type: BodyType
  body_type_title: string
  looks: Look[]
  summary: string
  fit_advice: string
  estimate: Estimate
  disclaimer: string
}
