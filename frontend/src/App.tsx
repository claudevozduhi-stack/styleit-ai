// Корневой компонент: маршруты приложения.
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CapsulePage } from './pages/CapsulePage'
import { ColorTypePage } from './pages/ColorTypePage'
import { FittingRoomPage } from './pages/FittingRoomPage'
import { HomePage } from './pages/HomePage'
import { MeasurementsPage } from './pages/MeasurementsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { StylePage } from './pages/StylePage'

/** Таблица маршрутов. Новые экраны добавляются сюда. */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/measurements" element={<MeasurementsPage />} />
        <Route path="/color-type" element={<ColorTypePage />} />
        <Route path="/style" element={<StylePage />} />
        <Route path="/capsule" element={<CapsulePage />} />
        <Route path="/fitting/:productId" element={<FittingRoomPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<p>Страница не найдена.</p>} />
      </Routes>
    </Layout>
  )
}
