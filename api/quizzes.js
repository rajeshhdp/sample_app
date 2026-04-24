import { nanoid } from 'nanoid'
import { readDB, writeDB, checkAdmin } from './_db.js'
import { del } from '@vercel/blob'

export default async function handler(req, res) {
  const { method } = req
  const id = req.query?.id

  // GET /api/quizzes or /api/quizzes/:id
  if (method === 'GET') {
    const db = await readDB()
    const isAdmin = checkAdmin(req)

    if (id) {
      // Public or admin can fetch a single quiz by id
      // Published-only guard for public users on single quiz fetch
      const quiz = db.quizzes.find(q => q.id === id && (isAdmin || q.published))
      if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
      return res.json(quiz)
    }

    // List: admins see all, public sees only published
    const list = isAdmin ? db.quizzes : db.quizzes.filter(q => q.published)
    const quizzesWithStats = list.map(quiz => {
      const responses = db.responses.filter(r => r.quizId === quiz.id)
      return {
        id: quiz.id,
        title: quiz.title,
        blobUrl: quiz.blobUrl,
        blobPathname: quiz.blobPathname,
        published: quiz.published,
        createdAt: quiz.createdAt,
        participantCount: responses.length,
        avgScore: responses.length
          ? Math.round(responses.reduce((sum, r) => sum + (r.score / r.totalQuestions) * 100, 0) / responses.length)
          : 0
      }
    })
    return res.json(quizzesWithStats)
  }

  // POST /api/quizzes — create new quiz (draft or published)
  if (method === 'POST') {
    if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const { title, blobUrl, blobPathname, questions, published = false } = req.body || {}
      if (!title || !blobUrl || !blobPathname || !questions) {
        return res.status(400).json({ error: 'Missing required fields: title, blobUrl, blobPathname, questions' })
      }
      const db = await readDB()
      const quiz = {
        id: nanoid(10),
        title,
        blobUrl,
        blobPathname,
        questions,
        published: !!published,
        createdAt: new Date().toISOString()
      }
      db.quizzes.push(quiz)
      await writeDB(db)
      return res.status(201).json(quiz)
    } catch (err) {
      console.error('Save quiz error:', err)
      return res.status(500).json({ error: 'Failed to save quiz: ' + err.message })
    }
  }

  // PUT /api/quizzes/:id — update quiz (title, questions, published toggle)
  if (method === 'PUT') {
    if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const db = await readDB()
      const idx = db.quizzes.findIndex(q => q.id === id)
      if (idx === -1) return res.status(404).json({ error: 'Quiz not found' })
      db.quizzes[idx] = { ...db.quizzes[idx], ...req.body, id }
      await writeDB(db)
      return res.json(db.quizzes[idx])
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update quiz: ' + err.message })
    }
  }

  // DELETE /api/quizzes/:id
  if (method === 'DELETE') {
    if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const db = await readDB()
      const quiz = db.quizzes.find(q => q.id === id)

      // Delete audio + transcript from Vercel Blob when requested
      if (req.query?.deleteBlob === 'true' && quiz?.blobUrl) {
        try {
          const urls = [
            quiz.blobUrl,
            quiz.blobUrl.replace(/\.(mp3|m4a|wav|ogg)$/i, '.txt')
          ]
          await del(urls)
        } catch { /* blob may already be gone — continue with DB cleanup */ }
      }

      db.quizzes = db.quizzes.filter(q => q.id !== id)
      db.responses = db.responses.filter(r => r.quizId !== id)
      await writeDB(db)
      return res.json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete quiz: ' + err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
