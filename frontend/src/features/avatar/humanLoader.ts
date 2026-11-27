// Загрузка файлов модели тела (public/models/body-v1.*) — только на странице примерки.
import { parseHumanModel, type HumanModel, type HumanModelHeader } from './humanModel'

/** Базовый адрес файлов модели относительно корня сайта. */
const MODEL_PATH = `${import.meta.env.BASE_URL}models/body-v1`

/** Загружает описание и данные модели и разбирает их; при сетевой ошибке — исключение. */
export async function loadHumanModel(fetcher: typeof fetch = fetch): Promise<HumanModel> {
  const [headerResponse, dataResponse] = await Promise.all([
    fetcher(`${MODEL_PATH}.json`),
    fetcher(`${MODEL_PATH}.bin`),
  ])
  if (!headerResponse.ok || !dataResponse.ok) {
    throw new Error('Не удалось загрузить модель тела')
  }
  const header = (await headerResponse.json()) as HumanModelHeader
  return parseHumanModel(header, await dataResponse.arrayBuffer())
}
