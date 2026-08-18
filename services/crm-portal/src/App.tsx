import { Routes, Route } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { CreateProjectPage } from './pages/CreateProjectPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/create" element={<CreateProjectPage />} />
    </Routes>
  )
}
