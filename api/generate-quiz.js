import Anthropic from '@anthropic-ai/sdk'
import { fetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js'
import { extractYoutubeId, checkAdmin } from './_db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })

  const { youtubeUrl } = req.body || {}
  if (!youtubeUrl) return res.status(400).json({ error: 'YouTube URL required' })

  const youtubeId = extractYoutubeId(youtubeUrl)
  if (!youtubeId) return res.status(400).json({ error: 'Invalid YouTube URL' })

  let transcript
  try {
    const transcriptItems = await fetchTranscript(youtubeId)
    if (!Array.isArray(transcriptItems) || transcriptItems.length === 0) {
      throw new Error('No captions available for this video')
    }
    transcript = transcriptItems.map(item => item.text).join(' ')
  } catch (err) {
    return res.status(422).json({
      error: `Could not fetch transcript: ${err.message}. Please ensure the video has captions enabled.`,
    })
  }

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
          content: `Here is the transcript of a Srila Prabhupada lecture:\n\n${transcript}\n\nPlease generate 5 quiz questions based on this transcript.`,
        },
      ],
    })

    const content = message.content[0].text.trim()
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Invalid response format from AI')
    const questions = JSON.parse(jsonMatch[0])
    res.json({ questions, youtubeId })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate quiz: ' + err.message })
  }
}
