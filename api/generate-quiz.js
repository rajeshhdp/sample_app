import Anthropic from '@anthropic-ai/sdk'
import { checkAdmin } from './_db.js'

const SYSTEM_PROMPT = `You are a Vaishnava education assistant helping devotees understand Srila Prabhupada's teachings. Given a lecture topic, generate a quiz title and 5 multiple choice questions that test understanding of the key philosophical points, Sanskrit terms, and practical instructions Srila Prabhupada typically discusses on this subject. Draw from your knowledge of his Bhagavad-gita As It Is, Srimad-Bhagavatam, and recorded lectures. Each question must have 4 options (A, B, C, D) with exactly one correct answer. Return ONLY a valid JSON object in this format:
{
  "title": string,
  "questions": [{
    "question": string,
    "options": [string, string, string, string],
    "correct": 0 | 1 | 2 | 3,
    "explanation": string
  }]
}
The title should be concise (max 60 chars), e.g. "Bhagavad-gita 2.13 — Transmigration of the Soul".`

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

  // Fallback: bare array
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })

  const { blobUrl, blobPathname, transcriptUrl, transcriptText } = req.body || {}
  if (!blobUrl || !blobPathname) {
    return res.status(400).json({ error: 'blobUrl and blobPathname are required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const topic = topicFromPathname(blobPathname)
  const client = new Anthropic({ apiKey })

  // Resolve transcript: manual text > blob txt file > none
  let resolvedTranscript = transcriptText ? transcriptText.trim() : null
  if (!resolvedTranscript && transcriptUrl) {
    try {
      const txtRes = await fetch(transcriptUrl)
      if (txtRes.ok) resolvedTranscript = (await txtRes.text()).trim()
    } catch { /* fall through to topic-only */ }
  }

  // Trim to ~3000 words to stay within token budget
  const trimmedTranscript = resolvedTranscript
    ? resolvedTranscript.split(/\s+/).slice(0, 3000).join(' ')
    : null

  const userMessage = trimmedTranscript
    ? `Here is a transcript of a Srila Prabhupada lecture (topic: "${topic}"):\n\n${trimmedTranscript}\n\nBased ONLY on what is actually said in this transcript, generate a quiz title and 5 multiple choice questions that test the listener's comprehension of the specific points, stories, instructions, and Sanskrit terms Prabhupada mentions in this lecture.`
    : `Generate a quiz title and 5 quiz questions based on a Srila Prabhupada lecture about: "${topic}". The questions should test philosophical understanding, Sanskrit terms used, and practical instructions Prabhupada gives on this topic.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })

    const content = message.content[0].text.trim()
    const { title, questions } = extractQuizData(content)
    res.json({ title: title || topic, questions })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate quiz: ' + err.message })
  }
}
