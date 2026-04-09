import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Admin from './pages/Admin.jsx'
import Quiz from './pages/Quiz.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import GlobalLeaderboard from './pages/GlobalLeaderboard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/quiz/:id" element={<Quiz />} />
        <Route path="/quiz/:id/leaderboard" element={<Leaderboard />} />
        <Route path="/leaderboard" element={<GlobalLeaderboard />} />
      </Routes>
    </BrowserRouter>
  )
}
