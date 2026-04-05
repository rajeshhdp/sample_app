export default function LeaderboardChart({ responses, totalQuestions }) {
  if (!responses.length) return null

  // Build score distribution buckets: 0, 1, 2, ... totalQuestions
  const buckets = Array(totalQuestions + 1).fill(0)
  responses.forEach(r => {
    if (r.score >= 0 && r.score <= totalQuestions) buckets[r.score]++
  })

  const maxCount = Math.max(...buckets, 1)

  return (
    <div className="bg-white rounded-xl border border-orange-100 p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
        Score Distribution
      </h3>
      <div className="flex items-end gap-1 h-24">
        {buckets.map((count, score) => (
          <div key={score} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500">{count > 0 ? count : ''}</span>
            <div
              className="w-full rounded-t-sm transition-all duration-500"
              style={{
                height: `${(count / maxCount) * 64}px`,
                minHeight: count > 0 ? '4px' : '0',
                background: score === totalQuestions
                  ? 'linear-gradient(to top, #f59e0b, #fbbf24)'
                  : 'linear-gradient(to top, #fb923c, #fdba74)'
              }}
            />
            <span className="text-xs font-medium text-gray-700">{score}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 text-center mt-2">Score (out of {totalQuestions})</p>
    </div>
  )
}
