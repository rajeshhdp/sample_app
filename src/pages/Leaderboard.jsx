import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import LeaderboardChart from '../components/LeaderboardChart.jsx'

const MEDALS = ['🥇', '🥈', '🥉']

function formatTime(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function getRankColor(rank) {
  if (rank === 1) return 'bg-yellow-50 border-yellow-300'
  if (rank === 2) return 'bg-gray-50 border-gray-300'
  if (rank === 3) return 'bg-orange-50 border-orange-300'
  return 'bg-white border-gray-100'
}

export default function Leaderboard() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState(null)
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/quizzes/${id}`).then(r => r.json()),
      fetch(`/api/responses/${id}`).then(r => r.json())
    ]).then(([quizData, respData]) => {
      setQuiz(quizData)
      setResponses(Array.isArray(respData) ? respData : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  function handleShare() {
    const url = `${window.location.origin}/quiz/${id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalQuestions = quiz?.questions?.length || 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(`/quiz/${id}`)} className="text-white/80 hover:text-white text-xl">‹</button>
            <span className="text-lg">🪷</span>
            <span className="font-bold">Prabhupada Quiz</span>
          </div>
          <div className="bg-white/20 rounded-2xl p-4">
            <h1 className="text-lg font-bold leading-snug">{quiz?.title}</h1>
            <p className="text-orange-100 text-sm mt-1">🏅 Leaderboard</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-orange-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-orange-600">{responses.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Players</p>
          </div>
          <div className="bg-white rounded-xl border border-orange-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-500">
              {responses.length
                ? Math.round(responses.reduce((s, r) => s + (r.score / r.totalQuestions) * 100, 0) / responses.length)
                : 0}%
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Avg Score</p>
          </div>
          <div className="bg-white rounded-xl border border-orange-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-500">
              {responses.length ? Math.max(...responses.map(r => r.score)) : 0}/{totalQuestions}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Top Score</p>
          </div>
        </div>

        {/* Chart */}
        {responses.length > 0 && (
          <LeaderboardChart responses={responses} totalQuestions={totalQuestions} />
        )}

        {/* Rankings */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Rankings
        </h2>

        {responses.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">📿</div>
            <p>No participants yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {responses.map((resp, i) => {
              const rank = i + 1
              const pct = Math.round((resp.score / resp.totalQuestions) * 100)
              return (
                <div
                  key={resp.id}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${getRankColor(rank)}`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-9 text-center">
                    {rank <= 3
                      ? <span className="text-2xl">{MEDALS[rank - 1]}</span>
                      : <span className="text-base font-bold text-gray-400">#{rank}</span>
                    }
                  </div>

                  {/* Name & score */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{resp.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: rank === 1
                              ? 'linear-gradient(to right, #f59e0b, #fbbf24)'
                              : 'linear-gradient(to right, #fb923c, #fdba74)'
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">{formatTime(resp.timeTakenSeconds)}</span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-lg font-bold ${rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-500' : rank === 3 ? 'text-orange-400' : 'text-gray-600'}`}>
                      {resp.score}/{resp.totalQuestions}
                    </p>
                    <p className="text-xs text-gray-400">{pct}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Share button */}
        <button
          onClick={handleShare}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold rounded-xl text-base shadow-md hover:shadow-lg transition-all active:scale-95"
        >
          {copied ? '✅ Link Copied!' : '📤 Share this Quiz'}
        </button>

        <button
          onClick={() => navigate(`/quiz/${id}`)}
          className="w-full mt-3 py-3 border-2 border-orange-300 text-orange-600 font-semibold rounded-xl text-sm"
        >
          Take Quiz Again
        </button>
      </div>
    </div>
  )
}
