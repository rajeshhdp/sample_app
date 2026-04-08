import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const LABELS = ['A', 'B', 'C', 'D']

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Question editor (inline) ───────────────────────────────────────────────
function QuestionEditor({ question, index, onChange }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-orange-100 p-3 mb-3">
      <label className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Q{index + 1}</label>
      <textarea
        className="w-full mt-1 p-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-orange-400 bg-white"
        rows={2}
        value={question.question}
        onChange={e => onChange({ ...question, question: e.target.value })}
      />
      <div className="space-y-1.5 mt-2">
        {question.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => onChange({ ...question, correct: i })}
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${question.correct === i ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-500'}`}
            >
              {LABELS[i]}
            </button>
            <input
              className="flex-1 p-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-white"
              value={opt}
              onChange={e => {
                const opts = [...question.options]; opts[i] = e.target.value
                onChange({ ...question, options: opts })
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2">
        <label className="text-xs text-gray-400">Explanation</label>
        <textarea
          className="w-full mt-1 p-1.5 border border-gray-200 rounded-lg text-xs resize-none focus:outline-none focus:border-orange-400 bg-white"
          rows={2}
          value={question.explanation}
          onChange={e => onChange({ ...question, explanation: e.target.value })}
        />
      </div>
    </div>
  )
}

// ── Blob card ─────────────────────────────────────────────────────────────
function BlobCard({ blob, quiz, password, onRefresh }) {
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [draft, setDraft] = useState(null) // { title, questions } — pending review
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [transcript, setTranscript] = useState('')

  const displayName = blob.pathname
    .split('/').pop()
    .replace(/\.(mp3|m4a|wav|ogg)$/i, '')
    .replace(/^clip_\d+_?/i, '')
    .replace(/[_-]+/g, ' ')

  async function handleGenerate() {
    setGenerating(true)
    setGenError('')
    setDraft(null)
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          transcriptText: transcript.trim() || undefined
        })
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { throw new Error(`Server error (${res.status})`) }
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setDraft({ title: data.title || displayName, questions: data.questions })
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveDraft(published) {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({
          title: draft.title,
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          questions: draft.questions,
          published
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDraft(null)
      onRefresh()
    } catch (err) {
      setGenError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTogglePublish() {
    if (!quiz) return
    setToggling(true)
    try {
      await fetch(`/api/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ published: !quiz.published })
      })
      onRefresh()
    } finally {
      setToggling(false)
    }
  }

  async function handleDeleteQuiz() {
    if (!quiz || !confirm(`Delete quiz "${quiz.title}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/quizzes/${quiz.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password }
      })
      onRefresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
      {/* Blob header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">🎵</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm leading-snug truncate">{displayName}</p>
          <p className="text-xs text-gray-400 truncate">
            {blob.pathname.split('/').pop()} · {formatSize(blob.size)}
          </p>
        </div>
      </div>

      {/* Quiz status */}
      <div className="px-4 pb-4">
        {/* No quiz yet */}
        {!quiz && !draft && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowTranscript(s => !s)}
                className="text-xs text-orange-500 hover:text-orange-700 underline"
              >
                {showTranscript ? '▲ Hide transcript' : '▼ Add transcript (optional)'}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
              >
                {generating
                  ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Generating...</>
                  : '✨ Generate Quiz'}
              </button>
            </div>
            {showTranscript && (
              <textarea
                className="w-full p-2 border border-orange-200 rounded-xl text-xs resize-none focus:outline-none focus:border-orange-400 bg-white mt-1"
                rows={5}
                placeholder="Paste the lecture transcript here so questions match the actual audio content..."
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
              />
            )}
            {!quiz && !draft && !showTranscript && (
              <p className="text-xs text-gray-400 italic">No quiz yet</p>
            )}
          </div>
        )}

        {/* Generation error */}
        {genError && (
          <p className="text-xs text-red-500 mt-2 p-2 bg-red-50 rounded-lg">{genError}</p>
        )}

        {/* Draft review */}
        {draft && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-orange-600 uppercase">Review Generated Quiz</span>
              <button onClick={() => setDraft(null)} className="text-gray-400 text-xs hover:text-gray-600 ml-auto">✕ Cancel</button>
            </div>
            <input
              className="w-full p-2 border border-orange-200 rounded-xl text-sm font-medium focus:outline-none focus:border-orange-400 mb-3"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="Quiz title"
            />
            <p className="text-xs text-gray-400 mb-2">Tap a letter to set correct answer.</p>
            {draft.questions.map((q, i) => (
              <QuestionEditor
                key={i}
                question={q}
                index={i}
                onChange={updated => {
                  const qs = [...draft.questions]; qs[i] = updated
                  setDraft(d => ({ ...d, questions: qs }))
                }}
              />
            ))}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleSaveDraft(false)}
                disabled={saving || !draft.title.trim()}
                className="flex-1 py-2.5 border-2 border-orange-400 text-orange-600 text-sm font-semibold rounded-xl disabled:opacity-50"
              >
                {saving ? 'Saving...' : '📝 Save Draft'}
              </button>
              <button
                onClick={() => handleSaveDraft(true)}
                disabled={saving || !draft.title.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-400 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
              >
                {saving ? 'Publishing...' : '🚀 Publish'}
              </button>
            </div>
          </div>
        )}

        {/* Existing quiz */}
        {quiz && !draft && (
          <div className="mt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-gray-700 flex-1 min-w-0 truncate">{quiz.title}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${quiz.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {quiz.published ? '🟢 Live' : '⚪ Draft'}
              </span>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <button
                onClick={handleTogglePublish}
                disabled={toggling}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border-2 transition-all ${
                  quiz.published
                    ? 'border-gray-300 text-gray-600 hover:border-gray-400'
                    : 'border-green-400 text-green-700 hover:bg-green-50'
                }`}
              >
                {toggling ? '...' : quiz.published ? 'Unpublish' : 'Publish'}
              </button>
              <button
                onClick={() => navigate(`/quiz/${quiz.id}`)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border-2 border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                Preview
              </button>
              <button
                onClick={() => navigate(`/quiz/${quiz.id}/leaderboard`)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border-2 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                🏅 Scores
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border-2 border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                {generating ? '...' : '↺ Regen'}
              </button>
              <button
                onClick={handleDeleteQuiz}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50"
              >
                {deleting ? '...' : 'Delete'}
              </button>
            </div>
            {showTranscript && (
              <textarea
                className="w-full mt-2 p-2 border border-blue-200 rounded-xl text-xs resize-none focus:outline-none focus:border-blue-400 bg-white"
                rows={4}
                placeholder="Paste transcript for more accurate regeneration..."
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
              />
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-xs text-gray-400 flex-1">
                {quiz.participantCount} participant{quiz.participantCount !== 1 ? 's' : ''} · created {formatDate(quiz.createdAt)}
              </p>
              <button
                onClick={() => setShowTranscript(s => !s)}
                className="text-xs text-blue-400 hover:text-blue-600 underline"
              >
                {showTranscript ? 'Hide transcript' : 'Add transcript'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Login screen ──────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (res.ok) { onLogin(password) }
      else setError('Invalid password. Try again.')
    } catch {
      setError('Could not connect to server.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🪷</div>
          <h1 className="text-xl font-bold text-gray-800">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-1">Prabhupada Quiz Manager</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 text-sm"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold rounded-xl">
            Login
          </button>
        </form>
        <button onClick={() => navigate('/')} className="w-full mt-3 text-center text-sm text-gray-400 hover:text-orange-500">
          ← Back to Home
        </button>
      </div>
    </div>
  )
}

// ── Main admin page ───────────────────────────────────────────────────────
export default function Admin() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [blobs, setBlobs] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const navigate = useNavigate()

  const loadData = useCallback(async (pwd) => {
    const pw = pwd ?? password
    setLoading(true)
    setLoadError('')
    try {
      const [blobsRes, quizzesRes] = await Promise.all([
        fetch('/api/blobs', { headers: { 'x-admin-password': pw } }),
        fetch('/api/quizzes', { headers: { 'x-admin-password': pw } })
      ])
      const [blobsData, quizzesData] = await Promise.all([blobsRes.json(), quizzesRes.json()])
      setBlobs(Array.isArray(blobsData) ? blobsData : [])
      setQuizzes(Array.isArray(quizzesData) ? quizzesData : [])
    } catch {
      setLoadError('Failed to load data. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [password])

  function handleLogin(pw) {
    setPassword(pw)
    setAuthed(true)
    loadData(pw)
  }

  if (!authed) return <LoginScreen onLogin={handleLogin} />

  // Orphaned quizzes — quiz exists but blob was deleted
  const orphanedQuizzes = quizzes.filter(
    q => q.blobPathname && !blobs.some(b => b.pathname === q.blobPathname)
  )

  async function handleDeleteOrphaned(quizId) {
    if (!confirm('Delete this quiz? The audio file no longer exists.')) return
    await fetch(`/api/quizzes/${quizId}`, { method: 'DELETE', headers: { 'x-admin-password': password } })
    loadData()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-white/80 hover:text-white text-xl">‹</button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-orange-100 text-xs">Manage audio quizzes</p>
          </div>
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="text-white/80 hover:text-white text-sm border border-white/30 rounded-lg px-3 py-1.5"
          >
            {loading ? '...' : '↺ Refresh'}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 mb-4">
            {loadError}
          </div>
        )}

        {loading && blobs.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && blobs.length === 0 && !loadError && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">🎵</div>
            <p className="font-medium text-gray-600">No audio files found</p>
            <p className="text-sm mt-2 text-gray-400 max-w-xs mx-auto">
              Upload MP3 files to your Vercel Blob store, then refresh this page.
            </p>
          </div>
        )}

        {/* Audio files list */}
        {blobs.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Audio Files ({blobs.length})
              </h2>
            </div>
            <div className="space-y-3">
              {blobs.map(blob => (
                <BlobCard
                  key={blob.pathname}
                  blob={blob}
                  quiz={quizzes.find(q => q.blobPathname === blob.pathname) || null}
                  password={password}
                  onRefresh={() => loadData()}
                />
              ))}
            </div>
          </>
        )}

        {/* Orphaned quizzes */}
        {orphanedQuizzes.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">
              ⚠ Audio Deleted — Orphaned Quizzes
            </h2>
            <div className="space-y-2">
              {orphanedQuizzes.map(quiz => (
                <div key={quiz.id} className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{quiz.title}</p>
                    <p className="text-xs text-red-400 truncate">{quiz.blobPathname}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteOrphaned(quiz.id)}
                    className="text-xs font-semibold text-red-500 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
