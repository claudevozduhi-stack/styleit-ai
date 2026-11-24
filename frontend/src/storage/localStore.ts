// Единственная точка доступа к localStorage.
// Все данные пользователя живут только здесь, на его устройстве, и не уходят на сервер на хранение.
import { MEASUREMENT_LIMITS, type Measurements } from '../types/body'

/** Префикс ключей, чтобы «Удалить мои данные» стирало всё наше и ничего чужого. */
const PREFIX = 'styleit:'
const MEASUREMENTS_KEY = `${PREFIX}measurements`

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
