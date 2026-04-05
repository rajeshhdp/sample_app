// Simple JSON file database helper for local/serverless use
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = resolve(__dirname, '../db.json')

export function readDB() {
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify({ quizzes: [], responses: [] }, null, 2))
  }
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf8'))
  } catch {
    return { quizzes: [], responses: [] }
  }
}

export function writeDB(data) {
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

export function checkAdmin(req) {
  const password = req.headers['x-admin-password']
  const adminPassword = process.env.ADMIN_PASSWORD || 'hare_krishna'
  return password === adminPassword
}
