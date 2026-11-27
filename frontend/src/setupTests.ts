// Подключает матчеры jest-dom (toBeInTheDocument и др.) ко всем тестам Vitest
// и очищает DOM после каждого теста, чтобы рендеры соседних тестов не смешивались.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
