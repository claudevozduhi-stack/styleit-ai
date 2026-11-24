// Единственная точка доступа к localStorage.
// Все данные пользователя живут только здесь, на его устройстве, и не уходят на сервер на хранение.
import type { Capsule, ColorAnalysis } from '../types/analysis'
import { MEASUREMENT_LIMITS, type Measurements } from '../types/body'

/** Префикс ключей, чтобы «Удалить мои данные» стирало всё наше и ничего чужого. */
const PREFIX = 'styleit:'
const MEASUREMENTS_KEY = `${PREFIX}measurements`
const COLOR_TYPE_KEY = `${PREFIX}color-type`
const CAPSULE_KEY = `${PREFIX}capsule`
const CLIENT_ID_KEY = `${PREFIX}client-id`

/** Безопасно читает значение: в приватном режиме или при запрете хранилища вернёт null. */
function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Безопасно записывает значение. Возвращает false, если браузер запретил запись. */
function writeRaw(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Проверяет, что число попадает в допустимый диапазон мерки. */
function inRange(value: unknown, limits: { min: number; max: number }): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= limits.min &&
    value <= limits.max
  )
}

/** Проверяет объект из хранилища: повреждённые или старые данные не должны ломать приложение. */
export function isValidMeasurements(value: unknown): value is Measurements {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  if (m.gender !== 'female' && m.gender !== 'male') return false
  const required = ['heightCm', 'weightKg', 'chestCm', 'waistCm', 'hipsCm'] as const
  if (!required.every((key) => inRange(m[key], MEASUREMENT_LIMITS[key]))) return false
  const optional = ['shouldersCm', 'inseamCm'] as const
  return optional.every((key) => m[key] === undefined || inRange(m[key], MEASUREMENT_LIMITS[key]))
}

/** Загружает сохранённые мерки или null, если их нет или они повреждены. */
export function loadMeasurements(): Measurements | null {
  const raw = readRaw(MEASUREMENTS_KEY)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isValidMeasurements(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Сохраняет мерки на устройстве. Возвращает false, если браузер запретил запись. */
export function saveMeasurements(measurements: Measurements): boolean {
  return writeRaw(MEASUREMENTS_KEY, JSON.stringify(measurements))
}

/** Читает JSON-объект; при ошибке разбора или проверки возвращает null. */
function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  const raw = readRaw(key)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isColorAnalysis(value: unknown): value is ColorAnalysis {
  const v = value as Partial<ColorAnalysis> | null
  return typeof v?.season === 'string' && Array.isArray(v.palette_hex)
}

function isCapsule(value: unknown): value is Capsule {
  const v = value as Partial<Capsule> | null
  return Array.isArray(v?.looks) && typeof v?.estimate === 'object'
}

/** Цветотип, определённый по анкете. */
export function loadColorType(): ColorAnalysis | null {
  return readJson(COLOR_TYPE_KEY, isColorAnalysis)
}

export function saveColorType(colorType: ColorAnalysis): boolean {
  return writeRaw(COLOR_TYPE_KEY, JSON.stringify(colorType))
}

/** Последняя собранная капсула — чтобы не тратить бесплатный лимит при перезагрузке страницы. */
export function loadCapsule(): Capsule | null {
  return readJson(CAPSULE_KEY, isCapsule)
}

export function saveCapsule(capsule: Capsule): boolean {
  return writeRaw(CAPSULE_KEY, JSON.stringify(capsule))
}

/**
 * Анонимный ID браузера для суточного лимита. Случайный UUID, не связан с личностью.
 * Если хранилище недоступно, ID живёт до закрытия вкладки.
 */
let sessionClientId: string | null = null
export function getClientId(): string {
  const saved = readRaw(CLIENT_ID_KEY)
  if (saved) return saved
  sessionClientId ??= crypto.randomUUID()
  writeRaw(CLIENT_ID_KEY, sessionClientId)
  return sessionClientId
}

/** Удаляет все данные StyleIt из браузера: мерки, цветотип, образы. */
export function clearAllUserData(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Хранилище недоступно — значит, и удалять нечего.
  }
}
