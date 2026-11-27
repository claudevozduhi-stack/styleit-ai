// Общие тестовые данные: вымышленный магазин и товары с адресами example.com.
import type { Capsule, LookItem } from '../types/analysis'
import type { Product } from '../types/catalog'

/** Капсула из одного образа с одной футболкой. */
export const capsule: Capsule = {
  body_type: 'hourglass',
  body_type_title: 'Песочные часы',
  summary: 'Базовая капсула.',
  fit_advice: 'Подчеркните талию.',
  disclaimer: 'Рекомендации ИИ носят справочный характер.',
  estimate: {
    items_count: 2,
    total_kzt: 17980,
    budget_kzt: 30000,
    remaining_kzt: 12020,
    within_budget: true,
  },
  looks: [
    {
      title: 'Город',
      explanation: 'Удобно и просто.',
      total_kzt: 17980,
      items: [
        {
          recommended_size: 'S',
          size_confidence: 'high',
          size_note: 'Размер S подходит по всем меркам.',
          product: {
            id: 1,
            title: 'Футболка базовая',
            store: 'Тестовый магазин',
            brand: 'Тест',
            category: 'tshirt',
            gender: 'unisex',
            price_kzt: 4990,
            color_name: 'белый',
            color_hex: '#ffffff',
            style_tags: ['casual'],
            season: 'all',
            product_url: 'https://example.com/p/1',
            collected_at: '2026-11-24',
          },
        },
      ],
    },
  ],
}

/** Вещь капсулы на основе футболки из фикстуры с другой категорией, цветом и ценой. */
function fixtureItem(
  id: number,
  title: string,
  category: Product['category'],
  colorHex: string,
): LookItem {
  const base = capsule.looks[0]!.items[0]!
  return {
    ...base,
    product: {
      ...base.product,
      id,
      title,
      category,
      color_hex: colorHex,
      price_kzt: 5000 + id * 1000,
      product_url: `https://example.com/p/${id}`,
    },
  }
}

const tshirtItem = capsule.looks[0]!.items[0]!
const jeansItem = fixtureItem(2, 'Джинсы прямые', 'jeans', '#1f3a5f')
const skirtItem = fixtureItem(3, 'Юбка миди', 'skirt', '#000000')
const jacketItem = fixtureItem(4, 'Куртка лёгкая', 'jacket', '#808080')

/** Капсула из двух образов стилиста: из неё код собирает ещё сочетания. */
export const outfitCapsule: Capsule = {
  ...capsule,
  looks: [
    { title: 'Город', explanation: 'Удобно.', items: [tshirtItem, jeansItem], total_kzt: 11990 },
    {
      title: 'Вечер',
      explanation: 'Строго.',
      items: [skirtItem, tshirtItem, jacketItem],
      total_kzt: 22990,
    },
  ],
}
