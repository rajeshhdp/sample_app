import Anthropic from '@anthropic-ai/sdk'
import { extractYoutubeId, checkAdmin } from './_db.js'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)'

function parseTranscriptXml(xml) {
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

async function fetchTracksFromUrl(captionUrl) {
  const captionRes = await fetch(captionUrl, { headers: { 'User-Agent': USER_AGENT } })
  if (!captionRes.ok) throw new Error('Failed to fetch caption data')
  return parseTranscriptXml(await captionRes.text())
}

async function fetchViaInnerTube(videoId) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
      videoId,
    }),
  })
  if (!res.ok) return null

  const data = await res.json()
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(tracks) || tracks.length === 0) return null

  return fetchTracksFromUrl(tracks[0].baseUrl)
}

async function fetchViaWebPage(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
  })
  if (!res.ok) throw new Error('Could not load YouTube page')

  const html = await res.text()

  if (html.includes('class="g-recaptcha"')) {
    throw new Error('YouTube is requiring a captcha — try again later')
  }

  // Extract ytInitialPlayerResponse from the page
  const marker = 'var ytInitialPlayerResponse = '
  const start = html.indexOf(marker)
  if (start === -1) throw new Error('Could not parse YouTube page')

  let depth = 0
  let i = start + marker.length
  let jsonStart = i
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++
    else if (html[i] === '}') { depth--; if (depth === 0) break }
  }

  const playerData = JSON.parse(html.slice(jsonStart, i + 1))
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error('No captions available for this video')
  }

  return fetchTracksFromUrl(tracks[0].baseUrl)
}

async function fetchYouTubeTranscript(videoId) {
  const result = await fetchViaInnerTube(videoId)
  if (result) return result
  return fetchViaWebPage(videoId)
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
