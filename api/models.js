import { checkAdmin } from './_db.js'

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })

  const models = (process.env.OPENROUTER_MODELS || '')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean)

  res.json(models)
}
