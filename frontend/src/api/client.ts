// Типизированный клиент API бэкенда. Все запросы фронтенда идут только через него.
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

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

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

/** Методы API, сгруппированные по разделам. */
export const api = {
  health: () => request<{ status: string }>('/health'),
  catalog: (query: CatalogQuery = {}) =>
    request<CatalogPage>(`/catalog${buildQuery({ ...query })}`),
}
