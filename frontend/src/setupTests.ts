// Подключает матчеры jest-dom (toBeInTheDocument и др.) ко всем тестам Vitest
// и очищает DOM после каждого теста, чтобы рендеры соседних тестов не смешивались.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(cleanup)

// В jsdom нет прокрутки окна; страницы вызывают её при переходе.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
