// Корневой компонент: маршруты приложения.
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { MeasurementsPage } from './pages/MeasurementsPage'
import { PrivacyPage } from './pages/PrivacyPage'

/** Таблица маршрутов. Новые экраны добавляются сюда. */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/measurements" element={<MeasurementsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<p>Страница не найдена.</p>} />
      </Routes>
    </Layout>
  )
}
