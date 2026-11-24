// Типы каталога — зеркало схем бэкенда (backend/app/schemas/catalog.py и app/core/vocab.py).

export type Gender = 'female' | 'male' | 'unisex'
export type Category =
  'tshirt' | 'shirt' | 'hoodie' | 'jacket' | 'trousers' | 'jeans' | 'skirt' | 'dress'
export type Style = 'casual' | 'office' | 'sport' | 'evening' | 'street'
export type Season = 'summer' | 'demi' | 'winter' | 'all'

/** Товар каталога. Фото нет намеренно: показываем свой 3D-рендер и ссылку на магазин. */
export interface Product {
  id: number
  title: string
  store: string
  brand: string
  category: Category
  gender: Gender
  price_kzt: number
  color_name: string
  color_hex: string
  style_tags: Style[]
  season: Season
  product_url: string
  collected_at: string
}

export interface CatalogPage {
  total: number
  items: Product[]
}

export interface CatalogQuery {
  category?: Category
  gender?: Gender
  style?: Style
  max_price?: number
  limit?: number
  offset?: number
}
