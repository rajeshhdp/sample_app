import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { fetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js'
import { nanoid } from 'nanoid'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '.env') })

const DB_PATH = resolve(__dirname, 'db.json')
const PORT = process.env.PORT || 3001

const app = express()
app.use(cors())
app.use(express.json())

// DB helpers
function readDB() {
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify({ quizzes: [], responses: [] }, null, 2))
  }
  return JSON.parse(readFileSync(DB_PATH, 'utf8'))
}

function writeDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

function extractYoutubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function getAdminPassword() {
  return (process.env.ADMIN_PASSWORD || 'hare_krishna').trim()
}

// Admin auth middleware
function requireAdmin(req, res, next) {
  const password = String(req.headers['x-admin-password'] ?? '').trim()
  if (password !== getAdminPassword()) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// GET /api/quizzes — list all quizzes
app.get('/api/quizzes', (req, res) => {
  const db = readDB()
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
  res.json(quizzesWithStats)
})

// GET /api/quizzes/:id — get single quiz
app.get('/api/quizzes/:id', (req, res) => {
  const db = readDB()
  const quiz = db.quizzes.find(q => q.id === req.params.id)
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
  res.json(quiz)
})

// POST /api/quizzes — save new quiz (admin only)
app.post('/api/quizzes', requireAdmin, (req, res) => {
  const { title, youtubeUrl, questions } = req.body
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
  res.status(201).json(quiz)
})

// PUT /api/quizzes/:id — update quiz (admin only)
app.put('/api/quizzes/:id', requireAdmin, (req, res) => {
  const db = readDB()
  const idx = db.quizzes.findIndex(q => q.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Quiz not found' })
  db.quizzes[idx] = { ...db.quizzes[idx], ...req.body, id: req.params.id }
  writeDB(db)
  res.json(db.quizzes[idx])
})

// DELETE /api/quizzes/:id — delete quiz (admin only)
app.delete('/api/quizzes/:id', requireAdmin, (req, res) => {
  const db = readDB()
  db.quizzes = db.quizzes.filter(q => q.id !== req.params.id)
  db.responses = db.responses.filter(r => r.quizId !== req.params.id)
  writeDB(db)
  res.json({ success: true })
})

// POST /api/generate-quiz — generate questions via Claude
app.post('/api/generate-quiz', requireAdmin, async (req, res) => {
  const { youtubeUrl } = req.body
  if (!youtubeUrl) return res.status(400).json({ error: 'YouTube URL required' })

  const youtubeId = extractYoutubeId(youtubeUrl)
  if (!youtubeId) return res.status(400).json({ error: 'Invalid YouTube URL' })

  // Fetch transcript
  let transcript
  try {
    const transcriptItems = await fetchTranscript(youtubeId)
    const fullText = transcriptItems.map(t => t.text).join(' ')
    // Trim to ~3000 words
    const words = fullText.split(/\s+/)
    transcript = words.slice(0, 3000).join(' ')
  } catch (err) {
    return res.status(422).json({
      error: 'This video does not have captions available. Please try another video.'
    })
  }

  // Call Claude
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a Vaishnava education assistant helping devotees understand Srila Prabhupada's teachings. Given this lecture transcript, generate 5 multiple choice questions that test understanding of the key philosophical points, Sanskrit terms used, and practical instructions given. Each question must have 4 options (A, B, C, D) with exactly one correct answer. Return ONLY a valid JSON array in this format:
[{
  "question": string,
  "options": [string, string, string, string],
  "correct": 0 | 1 | 2 | 3,
  "explanation": string
}]`,
      messages: [
        {
          role: 'user',
          content: `Here is the transcript of a Srila Prabhupada lecture:\n\n${transcript}\n\nPlease generate 5 quiz questions based on this transcript.`
        }
      ]
    })

    const content = message.content[0].text.trim()
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Invalid response format')
    const questions = JSON.parse(jsonMatch[0])
    res.json({ questions, youtubeId })
  } catch (err) {
    console.error('Claude API error:', err)
    res.status(500).json({ error: 'Failed to generate quiz: ' + err.message })
  }
})

// GET /api/responses/:quizId — get all responses for a quiz
app.get('/api/responses/:quizId', (req, res) => {
  const db = readDB()
  const responses = db.responses
    .filter(r => r.quizId === req.params.quizId)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.timeTakenSeconds - b.timeTakenSeconds
    })
  res.json(responses)
})

// POST /api/responses — submit quiz answers
app.post('/api/responses', (req, res) => {
  const { quizId, name, answers, timeTakenSeconds } = req.body
  if (!quizId || !name || !answers) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const db = readDB()
  const quiz = db.quizzes.find(q => q.id === quizId)
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' })

  const score = answers.reduce((sum, ans, i) => {
    return sum + (ans === quiz.questions[i].correct ? 1 : 0)
  }, 0)

  const response = {
    id: nanoid(10),
    quizId,
    name: name.trim(),
    answers,
    score,
    totalQuestions: quiz.questions.length,
    timeTakenSeconds: timeTakenSeconds || 0,
    submittedAt: new Date().toISOString()
  }

  db.responses.push(response)
  writeDB(db)
  res.status(201).json(response)
})

// Admin login check
app.post('/api/admin/login', (req, res) => {
  const password =
    typeof req.body?.password === 'string' ? req.body.password.trim() : ''
  if (password === getAdminPassword()) {
    res.json({ success: true })
  } else {
    res.status(401).json({ error: 'Invalid password' })
  }
})

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
