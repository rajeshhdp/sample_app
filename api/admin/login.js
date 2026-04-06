import { verifyAdminPassword } from '../_db.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { password } = req.body || {}
  if (verifyAdminPassword(password)) {
    return res.json({ success: true })
  }

  return res.status(401).json({ error: 'Invalid password' })
}
