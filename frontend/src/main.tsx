// Точка входа: подключает роутер, кэш запросов и стили.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Один повтор при сетевой ошибке: бесплатный хостинг иногда «просыпается» несколько секунд.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

const root = document.getElementById('root')
if (!root) throw new Error('В index.html нет элемента #root')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
