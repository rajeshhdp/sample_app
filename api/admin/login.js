export default function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { password } = req.body || {}
    const adminPassword = (process.env.ADMIN_PASSWORD || 'hare_krishna').trim()
    const inputPassword = String(password || '').trim()

    console.log('[login]', { 
      env: !!process.env.ADMIN_PASSWORD, 
      inputLen: inputPassword.length, 
      expectedLen: adminPassword.length,
      match: inputPassword === adminPassword 
    })

    if (inputPassword === adminPassword) {
      return res.json({ success: true })
    }

    return res.status(401).json({ error: 'Invalid password' })
  } catch (err) {
    console.error('[login error]', err)
    return res.status(500).json({ error: 'Server error: ' + err.message })
  }
}
