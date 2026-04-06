import Anthropic from '@anthropic-ai/sdk'
import { extractYoutubeId, checkAdmin } from './_db.js'

async function fetchYouTubeTranscript(videoId) {
  const playerRes = await fetch(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId,
      }),
    }
  )

  if (!playerRes.ok) throw new Error('Failed to fetch video info from YouTube')

  const playerData = await playerRes.json()
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error('No captions available for this video')
  }

  const captionRes = await fetch(tracks[0].baseUrl)
  if (!captionRes.ok) throw new Error('Failed to fetch caption data')

  const xml = await captionRes.text()
  return [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map(m =>
      m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()
    )
    .filter(Boolean)
    .join(' ')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })

  const { youtubeUrl } = req.body || {}
  if (!youtubeUrl) return res.status(400).json({ error: 'YouTube URL required' })

  const youtubeId = extractYoutubeId(youtubeUrl)
  if (!youtubeId) return res.status(400).json({ error: 'Invalid YouTube URL' })

  let transcript
  try {
    const fullText = await fetchYouTubeTranscript(youtubeId)
    transcript = fullText.split(/\s+/).slice(0, 3000).join(' ')
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
