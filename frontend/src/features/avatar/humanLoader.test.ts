// Тесты загрузки файлов модели тела.
import { describe, expect, it } from 'vitest'
import { loadHumanModel } from './humanLoader'

describe('загрузка модели тела', () => {
  it('сообщает об ошибке, если файл модели не загрузился', async () => {
    const failing = (() => Promise.resolve(new Response('', { status: 404 }))) as typeof fetch
    await expect(loadHumanModel(failing)).rejects.toThrow('Не удалось загрузить модель тела')
  })

  it('запрашивает описание и данные модели из каталога models', async () => {
    const requested: string[] = []
    const recording = ((url: string) => {
      requested.push(url)
      return Promise.resolve(new Response('', { status: 500 }))
    }) as typeof fetch
    await expect(loadHumanModel(recording)).rejects.toThrow()
    expect(requested).toEqual(['/models/body-v1.json', '/models/body-v1.bin'])
  })
})
