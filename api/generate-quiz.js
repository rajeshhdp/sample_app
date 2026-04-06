import Anthropic from '@anthropic-ai/sdk'
import { fetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js'
import { extractYoutubeId, checkAdmin } from './_db.js'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)'
const ANDROID_USER_AGENT = 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
const INNER_TUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

function parseTranscriptXml(xml) {
  const lines = []
  const regex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
  let match

  while ((match = regex.exec(xml)) !== null) {
    let text = match[3]
    let segment = ''
    const segmentRegex = /<s[^>]*>([^<]*)<\/s>/g
    let segmentMatch
    while ((segmentMatch = segmentRegex.exec(text)) !== null) {
      segment += segmentMatch[1]
    }
    if (!segment) {
      segment = text.replace(/<[^>]+>/g, '')
    }
    segment = decodeEntities(segment).trim()
    if (segment) lines.push(segment)
  }

  if (lines.length > 0) return lines

  const legacy = []
  const legacyRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g
  while ((match = legacyRegex.exec(xml)) !== null) {
    legacy.push(decodeEntities(match[3]))
  }
  return legacy
}

async function fetchViaInnerTube(videoId) {
  const res = await fetch(INNER_TUBE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': ANDROID_USER_AGENT,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '20.10.38',
          androidSdkVersion: 34,
        },
      },
      videoId,
    }),
  })
  if (!res.ok) return null

  const json = await res.json()
  const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(tracks) || tracks.length === 0) return null

  return fetchTranscriptFromTrack(tracks[0].baseUrl)
}

async function fetchViaWebPage(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error('Could not load YouTube page')

  const html = await res.text()
  if (html.includes('class="g-recaptcha"')) {
    throw new Error('YouTube is requiring a captcha — try again later')
  }

  const marker = 'var ytInitialPlayerResponse = '
  const start = html.indexOf(marker)
  if (start === -1) throw new Error('Could not parse YouTube page')

  let depth = 0
  let i = start + marker.length
  let jsonStart = i
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++
    else if (html[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }

  const playerData = JSON.parse(html.slice(jsonStart, i + 1))
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error('No captions available for this video')
  }

  return fetchTranscriptFromTrack(tracks[0].baseUrl)
}

async function fetchTranscriptFromTrack(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error('Failed to download transcript data')
  const xml = await res.text()
  const lines = parseTranscriptXml(xml)
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('Transcript XML could not be parsed')
  }
  return lines
}

async function fetchYouTubeTranscript(videoId) {
  try {
    const transcriptItems = await fetchTranscript(videoId, { lang: 'en' })
    if (Array.isArray(transcriptItems) && transcriptItems.length > 0) {
      return transcriptItems.map(item => item.text)
    }
  } catch (err) {
    console.warn('[generate-quiz] youtube-transcript failed:', err.message)
  }

  const innerTubeTranscript = await fetchViaInnerTube(videoId)
  if (innerTubeTranscript && innerTubeTranscript.length > 0) {
    return innerTubeTranscript
  }

  return await fetchViaWebPage(videoId)
}

// Robustly extract a JSON array using balanced bracket matching.
// A greedy regex like /\[[\s\S]*\]/ breaks when explanation text contains ']'.
function extractJsonArray(text) {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')

  try {
    const parsed = JSON.parse(stripped)
    if (Array.isArray(parsed)) return normalizeQuestions(parsed)
  } catch { /* fall through */ }

  const start = stripped.indexOf('[')
  if (start === -1) throw new Error('No JSON array found in AI response')

  let depth = 0
  let end = -1
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === '[') depth++
    else if (stripped[i] === ']') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }

  if (end === -1) throw new Error('Malformed JSON array in AI response')
  return normalizeQuestions(JSON.parse(stripped.slice(start, end + 1)))
}

// Ensure `correct` is always a number (Claude sometimes returns "0" as a string)
function normalizeQuestions(questions) {
  return questions.map(q => ({ ...q, correct: parseInt(q.correct, 10) }))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })

  const { youtubeUrl, transcriptText } = req.body || {}
  if (!youtubeUrl) return res.status(400).json({ error: 'YouTube URL required' })

  const youtubeId = extractYoutubeId(youtubeUrl)
  if (!youtubeId) return res.status(400).json({ error: 'Invalid YouTube URL' })

  let transcript
  try {
    if (typeof transcriptText === 'string' && transcriptText.trim().length > 0) {
      transcript = transcriptText.trim()
    } else {
      const transcriptItems = await fetchYouTubeTranscript(youtubeId)
      transcript = transcriptItems.join(' ')
    }
  } catch (err) {
    return res.status(422).json({
      error: `Could not fetch transcript: ${err.message}. Please ensure the video has captions enabled or provide transcript text manually.`,
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
    const questions = extractJsonArray(content)
    res.json({ questions, youtubeId })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate quiz: ' + err.message })
  }
}
