import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = resolve(__dirname, '../db.json')

// Lazy-initialised KV client — only created when KV_REST_API_URL is present.
// This lets the same code run locally (file) and on Vercel (KV) without changes.
let _kv = undefined
async function getKV() {
  if (_kv !== undefined) return _kv
  if (!process.env.KV_REST_API_URL) {
    _kv = null
    return null
  }
  try {
    const mod = await import('@vercel/kv')
    _kv = mod.kv
  } catch {
    _kv = null
  }
  return _kv
}

const EMPTY_DB = () => ({ quizzes: [], responses: [] })

export async function readDB() {
  const kv = await getKV()
  if (kv) {
    const data = await kv.get('prabhupada_db')
    return data || EMPTY_DB()
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
  const kv = await getKV()
  if (kv) {
    await kv.set('prabhupada_db', data)
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
