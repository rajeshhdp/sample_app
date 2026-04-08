import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { nanoid } from 'nanoid'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = resolve(__dirname, 'db.json')
const PORT = process.env.PORT || 3001

const app = express()
app.use(cors())
app.use(express.json())

// ── DB helpers ────────────────────────────────────────────────────────────
function readDB() {
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify({ quizzes: [], responses: [] }, null, 2))
  }
  return JSON.parse(readFileSync(DB_PATH, 'utf8'))
}
function writeDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

// ── Auth ──────────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const pw = req.headers['x-admin-password']
  if (pw !== (process.env.ADMIN_PASSWORD || 'hare_krishna')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ── Quiz JSON helpers ─────────────────────────────────────────────────────
function extractQuizData(text) {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  try {
    const start = stripped.indexOf('{')
    if (start !== -1) {
      let depth = 0, end = -1
      for (let i = start; i < stripped.length; i++) {
        if (stripped[i] === '{') depth++
        else if (stripped[i] === '}') { depth--; if (depth === 0) { end = i; break } }
      }
      if (end !== -1) {
        const parsed = JSON.parse(stripped.slice(start, end + 1))
        if (parsed.questions) {
          return { title: parsed.title || '', questions: normalizeQuestions(parsed.questions) }
        }
      }
    }
  } catch { /* fall through */ }
  const start = stripped.indexOf('[')
  if (start === -1) throw new Error('No JSON found in AI response')
  let depth = 0, end = -1
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === '[') depth++
    else if (stripped[i] === ']') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) throw new Error('Malformed JSON in AI response')
  return { title: '', questions: normalizeQuestions(JSON.parse(stripped.slice(start, end + 1))) }
}
function normalizeQuestions(questions) {
  return questions.map(q => ({ ...q, correct: parseInt(q.correct, 10) }))
}
function topicFromPathname(pathname) {
  return (pathname.split('/').pop() || pathname)
    .replace(/\.(mp3|m4a|wav|ogg)$/i, '')
    .replace(/^clip_\d+_?/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
}

// ── Admin login ───────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body
  const adminPw = (process.env.ADMIN_PASSWORD || 'hare_krishna').trim()
  if (String(password || '').trim() === adminPw) {
    res.json({ success: true })
  } else {
    res.status(401).json({ error: 'Invalid password' })
  }
})

// ── Blobs (local dev: empty — upload via Vercel dashboard) ────────────────
app.get('/api/blobs', requireAdmin, (req, res) => {
  // No Vercel Blob in local dev; return empty so admin page shows the message
  res.json([])
})

// ── Quizzes ───────────────────────────────────────────────────────────────
app.get('/api/quizzes', (req, res) => {
  const db = readDB()
  const isAdmin = req.headers['x-admin-password'] === (process.env.ADMIN_PASSWORD || 'hare_krishna')
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
  res.json(quizzesWithStats)
})

app.get('/api/quizzes/:id', (req, res) => {
  const db = readDB()
  const isAdmin = req.headers['x-admin-password'] === (process.env.ADMIN_PASSWORD || 'hare_krishna')
  const quiz = db.quizzes.find(q => q.id === req.params.id && (isAdmin || q.published))
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
  res.json(quiz)
})

app.post('/api/quizzes', requireAdmin, (req, res) => {
  try {
    const { title, blobUrl, blobPathname, questions, published = false } = req.body
    if (!title || !blobUrl || !blobPathname || !questions) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const db = readDB()
    const quiz = {
      id: nanoid(10),
      title, blobUrl, blobPathname, questions,
      published: !!published,
      createdAt: new Date().toISOString()
    }
    db.quizzes.push(quiz)
    writeDB(db)
    res.status(201).json(quiz)
  } catch (err) {
    res.status(500).json({ error: 'Failed to save quiz: ' + err.message })
  }
})

app.put('/api/quizzes/:id', requireAdmin, (req, res) => {
  try {
    const db = readDB()
    const idx = db.quizzes.findIndex(q => q.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Quiz not found' })
    db.quizzes[idx] = { ...db.quizzes[idx], ...req.body, id: req.params.id }
    writeDB(db)
    res.json(db.quizzes[idx])
  } catch (err) {
    res.status(500).json({ error: 'Failed to update quiz: ' + err.message })
  }
})

app.delete('/api/quizzes/:id', requireAdmin, (req, res) => {
  const db = readDB()
  db.quizzes = db.quizzes.filter(q => q.id !== req.params.id)
  db.responses = db.responses.filter(r => r.quizId !== req.params.id)
  writeDB(db)
  res.json({ success: true })
})

// ── Generate quiz ─────────────────────────────────────────────────────────
app.post('/api/generate-quiz', requireAdmin, async (req, res) => {
  const { blobUrl, blobPathname } = req.body
  if (!blobUrl || !blobPathname) {
    return res.status(400).json({ error: 'blobUrl and blobPathname are required' })
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const topic = topicFromPathname(blobPathname)
  const client = new Anthropic({ apiKey })

  const { transcriptText } = req.body
  const trimmedTranscript = transcriptText
    ? transcriptText.trim().split(/\s+/).slice(0, 3000).join(' ')
    : null

  const userMessage = trimmedTranscript
    ? `Here is a transcript of a Srila Prabhupada lecture (topic: "${topic}"):\n\n${trimmedTranscript}\n\nBased ONLY on what is actually said in this transcript, generate a quiz title and 5 multiple choice questions that test the listener's comprehension of the specific points, stories, instructions, and Sanskrit terms Prabhupada mentions in this lecture.`
    : `Generate a quiz based on a Srila Prabhupada lecture about: "${topic}". Test philosophical understanding, Sanskrit terms, and practical instructions Prabhupada gives on this topic.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a Vaishnava education assistant helping devotees understand Srila Prabhupada's teachings. Given a lecture topic, generate a quiz title and 5 multiple choice questions. Each question must have 4 options (A, B, C, D) with exactly one correct answer. Return ONLY a valid JSON object:
{
  "title": string,
  "questions": [{"question": string, "options": [string,string,string,string], "correct": 0|1|2|3, "explanation": string}]
}`,
      messages: [{ role: 'user', content: userMessage }]
    })
    const content = message.content[0].text.trim()
    const { title, questions } = extractQuizData(content)
    res.json({ title: title || topic, questions })
  } catch (err) {
    console.error('Generate error:', err)
    res.status(500).json({ error: 'Failed to generate quiz: ' + err.message })
  }
})

// ── Responses ─────────────────────────────────────────────────────────────
app.get('/api/responses/:quizId', (req, res) => {
  const db = readDB()
  const responses = db.responses
    .filter(r => r.quizId === req.params.quizId)
    .sort((a, b) => b.score !== a.score ? b.score - a.score : a.timeTakenSeconds - b.timeTakenSeconds)
  res.json(responses)
})

app.post('/api/responses', (req, res) => {
  try {
    const { quizId, name, answers, timeTakenSeconds } = req.body
    if (!quizId || !name || !answers) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const db = readDB()
    const quiz = db.quizzes.find(q => q.id === quizId)
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })

    const score = answers.reduce((sum, ans, i) => sum + (ans === quiz.questions[i]?.correct ? 1 : 0), 0)
    const response = {
      id: nanoid(10), quizId, name: name.trim(), answers, score,
      totalQuestions: quiz.questions.length,
      timeTakenSeconds: timeTakenSeconds || 0,
      submittedAt: new Date().toISOString()
    }
    db.responses.push(response)
    writeDB(db)
    res.status(201).json(response)
  } catch (err) {
    res.status(500).json({ error: 'Failed to save response: ' + err.message })
  }
})

app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
