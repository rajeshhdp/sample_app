import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = resolve(__dirname, '../db.json')

// Lazy-initialised Redis client.
// Uses Upstash Redis in production (UPSTASH_REDIS_REST_URL set by Vercel marketplace).
// Falls back to local db.json file in development.
let _redis = undefined
async function getRedis() {
  if (_redis !== undefined) return _redis
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    _redis = null
    return null
  }
  try {
    const { Redis } = await import('@upstash/redis')
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  } catch {
    _redis = null
  }
  return _redis
}

const EMPTY_DB = () => ({ quizzes: [], responses: [] })

export async function readDB() {
  const redis = await getRedis()
  if (redis) {
    const raw = await redis.get('prabhupada_db')
    if (!raw) return EMPTY_DB()
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  }
  // Local file fallback
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB(), null, 2))
  }
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf8'))
  } catch {
    return EMPTY_DB()
  }
}

export async function writeDB(data) {
  const redis = await getRedis()
  if (redis) {
    await redis.set('prabhupada_db', JSON.stringify(data))
    return
  }
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

export function extractYoutubeId(url) {
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

export function getAdminPassword() {
  return (process.env.ADMIN_PASSWORD || 'hare_krishna').trim()
}

export function verifyAdminPassword(password) {
  return String(password || '').trim() === getAdminPassword()
}

export function checkAdmin(req) {
  const password = req.headers['x-admin-password']
  return verifyAdminPassword(password)
}
