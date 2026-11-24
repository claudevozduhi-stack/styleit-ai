// Общие тестовые данные: вымышленный магазин и товары с адресами example.com.
import type { Capsule } from '../types/analysis'

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
