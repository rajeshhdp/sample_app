import { nanoid } from 'nanoid'
import { readDB, writeDB, extractYoutubeId, checkAdmin } from './_db.js'

export default function handler(req, res) {
  const { method } = req
  const id = req.query?.id

  // GET /api/quizzes or /api/quizzes/:id
  if (method === 'GET') {
    const db = readDB()
    if (id) {
      const quiz = db.quizzes.find(q => q.id === id)
      if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
      return res.json(quiz)
    }
    const quizzesWithStats = db.quizzes.map(quiz => {
      const responses = db.responses.filter(r => r.quizId === quiz.id)
      return {
        id: quiz.id,
        title: quiz.title,
        youtubeId: quiz.youtubeId,
        createdAt: quiz.createdAt,
        participantCount: responses.length,
        avgScore: responses.length
          ? Math.round(responses.reduce((sum, r) => sum + (r.score / r.totalQuestions) * 100, 0) / responses.length)
          : 0
      }
    })
    return res.json(quizzesWithStats)
  }

  // POST /api/quizzes
  if (method === 'POST') {
    if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })
    const { title, youtubeUrl, questions } = req.body || {}
    if (!title || !youtubeUrl || !questions) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const youtubeId = extractYoutubeId(youtubeUrl)
    if (!youtubeId) return res.status(400).json({ error: 'Invalid YouTube URL' })

    const db = readDB()
    const quiz = {
      id: nanoid(10),
      title,
      youtubeUrl,
      youtubeId,
      questions,
      createdAt: new Date().toISOString()
    }
    db.quizzes.push(quiz)
    writeDB(db)
    return res.status(201).json(quiz)
  }

  // PUT /api/quizzes/:id
  if (method === 'PUT') {
    if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })
    const db = readDB()
    const idx = db.quizzes.findIndex(q => q.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Quiz not found' })
    db.quizzes[idx] = { ...db.quizzes[idx], ...req.body, id }
    writeDB(db)
    return res.json(db.quizzes[idx])
  }

  // DELETE /api/quizzes/:id
  if (method === 'DELETE') {
    if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })
    const db = readDB()
    db.quizzes = db.quizzes.filter(q => q.id !== id)
    db.responses = db.responses.filter(r => r.quizId !== id)
    writeDB(db)
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
