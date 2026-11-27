/// <reference types="vitest/config" />
// Конфигурация сборки и тестов фронтенда.
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Кроме самого фронтенда разрешён только каталог размерных сеток (открытые цифры, без
    // персональных данных): тест sizePresets.test.ts сверяет с ним таблицу быстрого выбора.
    fs: { allow: ['.', '../data/size_charts'] },
  },
  build: {
    // three.js (~900 КБ, 250 КБ в gzip) грузится лениво только на странице примерки,
    // поэтому предупреждение о размере отдельного чанка поднято до этого объёма.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
