// Модель тела MakeHuman для тестов: тот же файл, что грузит примерочная, без сети.
import {
  parseHumanModel,
  type HumanModel,
  type HumanModelHeader,
} from '../features/avatar/humanModel'
import header from '../../public/models/body-v1.json'
import binaryUrl from '../../public/models/body-v1.bin?inline'

/** Декодирует data:-адрес base64 в байты. */
function decodeDataUrl(url: string): ArrayBuffer {
  const text = atob(url.slice(url.indexOf(',') + 1))
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index)
  return bytes.buffer
}

/** Разобранная модель тела (одна на все тесты). */
export const testHumanModel: HumanModel = parseHumanModel(
  header as HumanModelHeader,
  decodeDataUrl(binaryUrl),
)
