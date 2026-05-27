import { checkAdmin } from './_db.js'

const JSON_SCHEMA = `{
  "title": string,
  "questions": [{
    "question": string,
    "options": [string, string, string, string],
    "correct": 0 | 1 | 2 | 3,
    "explanation": string
  }]
}`

const SYSTEM_PROMPTS = {
  basic: `You are a Vaishnava education assistant. Generate a quiz title and 5 multiple choice questions at a BASIC level that test recall and comprehension of Srila Prabhupada's lecture. Focus on: key statements made, Sanskrit terms defined, specific instructions given, and stories or examples mentioned. Each question must be directly answerable from having listened to the lecture carefully. Each question must have 4 options (A, B, C, D) with exactly one correct answer. Return ONLY a valid JSON object in this format:
${JSON_SCHEMA}
The title should be concise (max 60 chars), e.g. "Bhagavad-gita 2.13 — Transmigration of the Soul".`,

  advanced: `You are a Vaishnava education assistant. Generate a quiz title and 5 multiple choice questions at an ADVANCED level that test in-depth philosophical understanding of Srila Prabhupada's teachings. Focus on: the underlying principles behind instructions, subtle distinctions between concepts, how this lecture connects to broader Vaishnava philosophy, the 'why' behind Prabhupada's reasoning, and nuances that require study of his books (Bhagavad-gita As It Is, Srimad-Bhagavatam). Questions should genuinely challenge someone with prior knowledge. Each question must have 4 options (A, B, C, D) with exactly one correct answer. Return ONLY a valid JSON object in this format:
${JSON_SCHEMA}
The title should be concise (max 60 chars), e.g. "Bhagavad-gita 2.13 — Transmigration of the Soul".`
}

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

  const { blobUrl, blobPathname, transcriptUrl, transcriptText, model, level = 'basic' } = req.body || {}
  if (!blobUrl || !blobPathname) {
    return res.status(400).json({ error: 'blobUrl and blobPathname are required' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })

  // Pick model: requested → first in env list → hard fallback
  const availableModels = (process.env.OPENROUTER_MODELS || '')
    .split(',').map(m => m.trim()).filter(Boolean)
  const selectedModel = (model && availableModels.includes(model))
    ? model
    : (availableModels[0] || 'anthropic/claude-haiku-4-5')

  const systemPrompt = SYSTEM_PROMPTS[level] || SYSTEM_PROMPTS.basic
  const topic = topicFromPathname(blobPathname)

  // Resolve transcript: manual text > blob txt file > none
  let resolvedTranscript = transcriptText ? transcriptText.trim() : null
  if (!resolvedTranscript && transcriptUrl) {
    try {
      const txtRes = await fetch(transcriptUrl)
      if (txtRes.ok) resolvedTranscript = (await txtRes.text()).trim()
    } catch { /* fall through to topic-only */ }
  }

  const trimmedTranscript = resolvedTranscript
    ? resolvedTranscript.split(/\s+/).slice(0, 3000).join(' ')
    : null

  const userMessage = trimmedTranscript
    ? `Here is a transcript of a Srila Prabhupada lecture (topic: "${topic}"):\n\n${trimmedTranscript}\n\nBased ONLY on what is actually said in this transcript, generate a quiz title and 5 questions at the ${level} level as described in your instructions.`
    : `Generate a quiz title and 5 questions at the ${level} level based on a Srila Prabhupada lecture about: "${topic}".`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Srila Prabhupada Quiz'
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || `OpenRouter error ${response.status}`)
    }

    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('Empty response from model')

    const { title, questions } = extractQuizData(content)
    res.json({ title: title || topic, questions, model: selectedModel, level })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate quiz: ' + err.message })
  }
}
