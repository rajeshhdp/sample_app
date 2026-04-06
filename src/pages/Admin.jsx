import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const LABELS = ['A', 'B', 'C', 'D']

function QuestionEditor({ question, index, onChange }) {
  return (
    <div className="bg-white rounded-xl border border-orange-100 p-4 mb-4">
      <label className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
        Question {index + 1}
      </label>
      <textarea
        className="w-full mt-1 p-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-orange-400"
        rows={2}
        value={question.question}
        onChange={e => onChange({ ...question, question: e.target.value })}
      />
      <div className="space-y-2 mt-2">
        {question.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => onChange({ ...question, correct: i })}
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${question.correct === i ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-500'}`}
              title="Set as correct answer"
            >
              {LABELS[i]}
            </button>
            <input
              className="flex-1 p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
              value={opt}
              onChange={e => {
                const newOpts = [...question.options]
                newOpts[i] = e.target.value
                onChange({ ...question, options: newOpts })
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2">
        <label className="text-xs text-gray-500">Explanation</label>
        <textarea
          className="w-full mt-1 p-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-orange-400"
          rows={2}
          value={question.explanation}
          onChange={e => onChange({ ...question, explanation: e.target.value })}
        />
      </div>
    </div>
  )
}

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')

  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const [questions, setQuestions] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)

  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (res.ok) {
        setAuthed(true)
      } else if (res.status === 404) {
        setAuthError(
          'API not found. Use npm run dev with the backend running, or start the server on port 3001.'
        )
      } else {
        setAuthError('Invalid password. Try again.')
      }
    } catch {
      setAuthError('Could not connect to server.')
    }
  }

  async function handleGenerate() {
    if (!youtubeUrl.trim()) return
    setGenerating(true)
    setGenError('')
    setQuestions(null)
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password
        },
        body: JSON.stringify({ youtubeUrl })
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { throw new Error(`Server error (${res.status})`) }
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setQuestions(data.questions)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!title.trim() || !questions) return
    setSaving(true)
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password
        },
        body: JSON.stringify({ title, youtubeUrl, questions })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSavedId(data.id)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🪷</div>
            <h1 className="text-xl font-bold text-gray-800">Admin Login</h1>
            <p className="text-sm text-gray-500 mt-1">Prabhupada Quiz Manager</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 text-sm"
              autoFocus
            />
            {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold rounded-xl hover:opacity-90 transition-all"
            >
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

  if (savedId) {
    const quizUrl = `${window.location.origin}/quiz/${savedId}`
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Quiz Saved!</h2>
          <p className="text-sm text-gray-500 mb-4">Share this link with devotees:</p>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 break-all text-sm text-orange-700 font-mono">
            {quizUrl}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(quizUrl) }}
            className="w-full py-3 mb-3 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold rounded-xl"
          >
            📋 Copy Link
          </button>
          <button
            onClick={() => navigate(`/quiz/${savedId}`)}
            className="w-full py-3 border border-orange-300 text-orange-600 font-semibold rounded-xl"
          >
            Preview Quiz
          </button>
          <button
            onClick={() => { setQuestions(null); setTitle(''); setYoutubeUrl(''); setSavedId(null) }}
            className="w-full mt-3 text-sm text-gray-400 hover:text-orange-500"
          >
            Create Another Quiz
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-white/80 hover:text-white text-xl">‹</button>
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-orange-100 text-xs">Generate & manage quizzes</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* YouTube URL */}
        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5">
          <label className="text-xs font-semibold text-orange-600 uppercase tracking-wide block mb-2">
            YouTube Video URL
          </label>
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !youtubeUrl.trim()}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold rounded-xl text-base shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating Questions...
            </>
          ) : (
            '✨ Generate Quiz Questions'
          )}
        </button>

        {genError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {genError}
          </div>
        )}

        {/* Questions editor */}
        {questions && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5">
              <label className="text-xs font-semibold text-orange-600 uppercase tracking-wide block mb-2">
                Quiz Title
              </label>
              <input
                type="text"
                placeholder="e.g. Bhagavad-gita Chapter 2 — Sankhya Yoga"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Review & Edit Questions
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Tap a letter (A/B/C/D) to set the correct answer.
              </p>
              {questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  question={q}
                  index={i}
                  onChange={updated => {
                    const newQs = [...questions]
                    newQs[i] = updated
                    setQuestions(newQs)
                  }}
                />
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-400 text-white font-bold rounded-xl text-base shadow-md disabled:opacity-50"
            >
              {saving ? 'Saving...' : '💾 Save & Publish Quiz'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
