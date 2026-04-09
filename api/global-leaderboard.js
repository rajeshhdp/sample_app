import { readDB } from './_db.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const db = await readDB()
    const publishedIds = new Set(db.quizzes.filter(q => q.published).map(q => q.id))

    // Only count responses for published quizzes
    const responses = db.responses.filter(r => publishedIds.has(r.quizId))

    // Aggregate by name (case-insensitive grouping, display as first seen)
    const userMap = {}
    for (const r of responses) {
      const key = r.name.trim().toLowerCase()
      if (!userMap[key]) {
        userMap[key] = { name: r.name.trim(), attempts: [], quizzesSeen: new Set() }
      }
      userMap[key].attempts.push(Math.round((r.score / r.totalQuestions) * 100))
      userMap[key].quizzesSeen.add(r.quizId)
    }

    const players = Object.values(userMap).map(u => ({
      name: u.name,
      quizzesAttempted: u.quizzesSeen.size,
      totalAttempts: u.attempts.length,
      avgScore: Math.round(u.attempts.reduce((s, v) => s + v, 0) / u.attempts.length),
      bestScore: Math.max(...u.attempts)
    }))

    // Sort: avgScore desc → quizzesAttempted desc → name asc
    players.sort((a, b) =>
      b.avgScore !== a.avgScore ? b.avgScore - a.avgScore
        : b.quizzesAttempted !== a.quizzesAttempted ? b.quizzesAttempted - a.quizzesAttempted
          : a.name.localeCompare(b.name)
    )

    // Assign rank (shared rank for equal scores)
    let rank = 1
    for (let i = 0; i < players.length; i++) {
      if (i > 0 && (players[i].avgScore !== players[i - 1].avgScore ||
        players[i].quizzesAttempted !== players[i - 1].quizzesAttempted)) {
        rank = i + 1
      }
      players[i].rank = rank
    }

    res.json({
      players,
      totalPlayers: players.length,
      totalAttempts: responses.length
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leaderboard: ' + err.message })
  }
}
