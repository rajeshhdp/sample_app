import { useNavigate } from 'react-router-dom'

const LABELS = ['A', 'B', 'C', 'D']

function getScoreEmoji(score, total) {
  const pct = score / total
  if (pct === 1) return '🏆'
  if (pct >= 0.8) return '🌟'
  if (pct >= 0.6) return '👍'
  if (pct >= 0.4) return '🙏'
  return '📚'
}

function getScoreMessage(score, total) {
  const pct = score / total
  if (pct === 1) return 'Perfect! Hare Krishna! 🎉'
  if (pct >= 0.8) return 'Excellent! Very good understanding!'
  if (pct >= 0.6) return 'Good effort! Keep studying!'
  if (pct >= 0.4) return 'A good start — watch the lecture again!'
  return 'Please revisit the lecture for deeper understanding.'
}

export default function ScoreScreen({ score, totalQuestions, questions, userAnswers, quizId }) {
  const navigate = useNavigate()

  return (
    <div className="pb-8">
      {/* Score banner */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 rounded-2xl p-6 text-center text-white mb-6 shadow-lg">
        <div className="text-5xl mb-2">{getScoreEmoji(score, totalQuestions)}</div>
        <h2 className="text-2xl font-bold mb-1">
          You scored {score} out of {totalQuestions}!
        </h2>
        <p className="text-orange-100 text-sm">{getScoreMessage(score, totalQuestions)}</p>
        <div className="mt-3 bg-white/20 rounded-full h-3 overflow-hidden">
          <div
            className="bg-white h-full rounded-full transition-all duration-700"
            style={{ width: `${(score / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question review */}
      <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">
        Review Answers
      </h3>
      {questions.map((q, i) => {
        const userAns = userAnswers[i]
        const correct = q.correct
        const isCorrect = userAns === correct

        return (
          <div key={i} className={`rounded-xl border-2 p-4 mb-4 ${isCorrect ? 'border-green-300 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-start gap-2 mb-2">
              <span className="text-lg">{isCorrect ? '✅' : '❌'}</span>
              <p className="font-medium text-gray-800 text-sm leading-snug">
                {i + 1}. {q.question}
              </p>
            </div>
            <div className="space-y-1 ml-7">
              {q.options.map((opt, j) => {
                let optClass = 'text-gray-500'
                let bgClass = ''
                let badge = null
                if (j === correct) {
                  optClass = 'text-green-700 font-semibold'
                  bgClass = 'bg-green-100 border border-green-300'
                  badge = <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded ml-1">Correct</span>
                }
                if (j === userAns && !isCorrect) {
                  optClass = 'text-red-600'
                  bgClass = 'bg-red-100 border border-red-200'
                  badge = <span className="text-xs bg-red-400 text-white px-1.5 py-0.5 rounded ml-1">Your answer</span>
                }
                return (
                  <div key={j} className={`flex items-center gap-2 rounded-lg p-2 text-sm ${bgClass}`}>
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold ${j === correct ? 'bg-green-400 text-white' : j === userAns && !isCorrect ? 'bg-red-300 text-white' : ''}`}>
                      {LABELS[j]}
                    </span>
                    <span className={optClass}>{opt}</span>
                    {badge}
                  </div>
                )
              })}
            </div>
            <div className="mt-3 ml-7 p-2 bg-white/70 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600">
                <span className="font-semibold text-orange-600">Explanation: </span>
                {q.explanation}
              </p>
            </div>
          </div>
        )
      })}

      <button
        onClick={() => navigate(`/quiz/${quizId}/leaderboard`)}
        className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold rounded-xl text-lg shadow-md hover:shadow-lg transition-all active:scale-95"
      >
        🏅 View Leaderboard
      </button>
    </div>
  )
}
