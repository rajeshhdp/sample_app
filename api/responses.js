import { nanoid } from 'nanoid'
import { readDB, writeDB } from './_db.js'

export default async function handler(req, res) {
  const { method } = req
  const quizId = req.query?.quizId

  // GET /api/responses/:quizId
  if (method === 'GET') {
    if (!quizId) return res.status(400).json({ error: 'quizId required' })
    const db = await readDB()
    const responses = db.responses
      .filter(r => r.quizId === quizId)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.timeTakenSeconds - b.timeTakenSeconds
      })
    return res.json(responses)
  }

  // POST /api/responses
  if (method === 'POST') {
    try {
      const { quizId: bodyQuizId, name, answers, timeTakenSeconds } = req.body || {}
      if (!bodyQuizId || !name || !answers) {
        return res.status(400).json({ error: 'Missing required fields' })
      }
      const db = await readDB()
      const quiz = db.quizzes.find(q => q.id === bodyQuizId)
      if (!quiz) return res.status(404).json({ error: 'Quiz not found' })

      const score = answers.reduce((sum, ans, i) => {
        return sum + (ans === quiz.questions[i]?.correct ? 1 : 0)
      }, 0)

      const response = {
        id: nanoid(10),
        quizId: bodyQuizId,
        name: name.trim(),
        answers,
        score,
        totalQuestions: quiz.questions.length,
        timeTakenSeconds: timeTakenSeconds || 0,
        submittedAt: new Date().toISOString()
      }
      db.responses.push(response)
      await writeDB(db)
      return res.status(201).json(response)
    } catch (err) {
      console.error('Save response error:', err)
      return res.status(500).json({ error: 'Failed to save response: ' + err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
