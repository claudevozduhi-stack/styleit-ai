// Типизированный клиент API бэкенда. Все запросы фронтенда идут только через него.
import type {
  Capsule,
  CapsuleRequest,
  ColorAnalysis,
  ColorAnalysisRequest,
  MeasurementsApi,
  SizeRecommendation,
} from '../types/analysis'
import type { Measurements } from '../types/body'
import type { CatalogPage, CatalogQuery } from '../types/catalog'

/** Ошибка ответа API с HTTP-статусом и понятным текстом для пользователя. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Адрес бэкенда. В разработке по умолчанию localhost; в собранном сайте он обязан быть задан
 * через VITE_API_URL — иначе запросы ушли бы на компьютер посетителя и упали бы с непонятной ошибкой.
 */
export function resolveApiUrl(configured: string | undefined, isDev: boolean): string {
  const value = configured?.trim()
  if (value) return value.replace(/\/$/, '')
  return isDev ? 'http://localhost:8000' : ''
}

const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV)

/** Превращает объект параметров в строку запроса, пропуская пустые значения. */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/** Выполняет запрос и разбирает JSON; при ошибке бросает ApiError с сообщением сервера. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new ApiError(0, 'Адрес сервера не настроен: задайте VITE_API_URL для этого деплоя.')
  }
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'Сервер недоступен. Проверьте интернет и попробуйте ещё раз.')
  }
  if (!response.ok) {
    let message = `Ошибка сервера (${response.status})`
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') message = body.detail
    } catch {
      // Тело ответа не JSON — оставляем общее сообщение.
    }
    throw new ApiError(response.status, message)
  }
  return (await response.json()) as T
}

/** Переводит мерки из формата фронтенда в формат API. */
export function toApiMeasurements(m: Measurements): MeasurementsApi {
  return {
    gender: m.gender,
    height_cm: m.heightCm,
    weight_kg: m.weightKg,
    chest_cm: m.chestCm,
    waist_cm: m.waistCm,
    hips_cm: m.hipsCm,
    ...(m.shouldersCm !== undefined && { shoulders_cm: m.shouldersCm }),
    ...(m.inseamCm !== undefined && { inseam_cm: m.inseamCm }),
  }
}

/** Тело POST-запроса в JSON. */
function post(body: unknown, headers?: Record<string, string>): RequestInit {
  return { method: 'POST', body: JSON.stringify(body), headers }
}

/** Методы API, сгруппированные по разделам. */
export const api = {
  health: () => request<{ status: string }>('/health'),
  catalog: (query: CatalogQuery = {}) =>
    request<CatalogPage>(`/catalog${buildQuery({ ...query })}`),
  colorType: (body: ColorAnalysisRequest) => request<ColorAnalysis>('/analysis/color', post(body)),
  recommendSize: (productId: number, measurements: Measurements) =>
    request<SizeRecommendation>(
      '/size/recommend',
      post({ product_id: productId, measurements: toApiMeasurements(measurements) }),
    ),
  capsule: (body: CapsuleRequest, clientId: string) =>
    request<Capsule>('/stylist/capsule', post(body, { 'X-Client-Id': clientId })),
}
