import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const MEDALS = ['🥇', '🥈', '🥉']

function getRankStyle(rank) {
  if (rank === 1) return 'bg-yellow-50 border-yellow-300'
  if (rank === 2) return 'bg-gray-50 border-gray-300'
  if (rank === 3) return 'bg-orange-50 border-orange-300'
  return 'bg-white border-gray-100'
}

function getScoreColor(score) {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-500'
  return 'text-red-400'
}

export default function GlobalLeaderboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/global-leaderboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load leaderboard.'); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const players = data?.players || []

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white px-4 pt-10 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/')} className="text-white/80 hover:text-white text-xl">‹</button>
            <span className="text-lg">🪷</span>
            <span className="font-bold">Prabhupada Quiz</span>
          </div>
          <div className="bg-white/20 rounded-2xl p-4">
            <h1 className="text-xl font-bold">🏆 Global Leaderboard</h1>
            <p className="text-orange-100 text-sm mt-1">All devotees, all quizzes</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-orange-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-orange-600">{data?.totalPlayers ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Devotees</p>
          </div>
          <div className="bg-white rounded-xl border border-orange-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-500">{data?.totalAttempts ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total Attempts</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 mb-4">{error}</div>
        )}

        {players.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📿</div>
            <p className="font-medium">No participants yet.</p>
            <p className="text-sm mt-1">Be the first to take a quiz!</p>
          </div>
        )}

        {/* Rankings */}
        {players.length > 0 && (
          <>
            {/* Column headers */}
            <div className="flex items-center gap-3 px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <div className="w-9 text-center">Rank</div>
              <div className="flex-1">Devotee</div>
              <div className="w-14 text-center">Quizzes</div>
              <div className="w-14 text-right">Avg</div>
            </div>

            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.name}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 ${getRankStyle(player.rank)}`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-9 text-center">
                    {player.rank <= 3
                      ? <span className="text-2xl">{MEDALS[player.rank - 1]}</span>
                      : <span className="text-sm font-bold text-gray-400">#{player.rank}</span>
                    }
                  </div>

                  {/* Name + progress bar */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{player.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${player.avgScore}%`,
                            background: player.rank === 1
                              ? 'linear-gradient(to right, #f59e0b, #fbbf24)'
                              : 'linear-gradient(to right, #fb923c, #fdba74)'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quizzes attempted */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <p className="text-sm font-bold text-gray-600">{player.quizzesAttempted}</p>
                    <p className="text-xs text-gray-400">quiz{player.quizzesAttempted !== 1 ? 'zes' : ''}</p>
                  </div>

                  {/* Avg score */}
                  <div className="flex-shrink-0 w-14 text-right">
                    <p className={`text-lg font-bold ${getScoreColor(player.avgScore)}`}>
                      {player.avgScore}%
                    </p>
                    {player.bestScore !== player.avgScore && (
                      <p className="text-xs text-gray-400">best {player.bestScore}%</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full mt-8 py-3 border-2 border-orange-300 text-orange-600 font-semibold rounded-xl text-sm"
        >
          ← Back to Quizzes
        </button>
      </div>
    </div>
  )
}
