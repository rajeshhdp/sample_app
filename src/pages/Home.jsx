import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PrabhupadaLogoWithFallback } from '../components/PrabhupadaLogo.jsx'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Home() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/quizzes')
      .then(r => r.json())
      .then(data => {
        // API returns only published quizzes for unauthenticated requests
        setQuizzes(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white px-4 pt-12 pb-8">
        <div className="max-w-lg mx-auto text-center">
          <div className="flex justify-center mb-3">
            <PrabhupadaLogoWithFallback size="lg" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Srila Prabhupada Quiz</h1>
          <p className="text-orange-100 text-sm mt-1">Test your understanding of Srila Prabhupada's teachings</p>
          <button
            onClick={() => navigate('/leaderboard')}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl text-sm transition-all border border-white/30"
          >
            🏆 Global Leaderboard
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Available Quizzes
        </h2>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && quizzes.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📿</div>
            <p className="font-medium">No quizzes available yet.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        )}

        <div className="space-y-3">
          {quizzes.map(quiz => (
            <button
              key={quiz.id}
              onClick={() => navigate(`/quiz/${quiz.id}`)}
              className="w-full text-left bg-white rounded-2xl shadow-sm border border-orange-100 p-4 hover:shadow-md hover:border-orange-300 transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">🎵</span>
                    <h3 className="font-semibold text-gray-800 leading-snug truncate">{quiz.title}</h3>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(quiz.createdAt)}</p>
                </div>
                <div className="flex-shrink-0 text-orange-500 text-xl mt-0.5">›</div>
              </div>
              <div className="flex gap-4 mt-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-orange-600">{quiz.participantCount}</p>
                  <p className="text-xs text-gray-400">Participants</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-500">
                    {quiz.avgScore > 0 ? `${quiz.avgScore}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-400">Avg Score</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/admin')}
            className="text-xs text-gray-400 hover:text-orange-500 transition-colors"
          >
            Admin →
          </button>
        </div>
      </div>
    </div>
  )
}
