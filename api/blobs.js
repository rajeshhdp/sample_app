import { list } from '@vercel/blob'
import { checkAdmin } from './_db.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.json([])
  }

  try {
    const { blobs } = await list()
    const audioBlobs = blobs
      .filter(b => /\.(mp3|m4a|wav|ogg)$/i.test(b.pathname))
      .map(b => ({
        url: b.url,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt
      }))
    res.json(audioBlobs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to list blobs: ' + err.message })
  }
}
