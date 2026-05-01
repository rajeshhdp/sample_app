import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AudioPlayer from '../components/AudioPlayer.jsx'
import QuestionCard from '../components/QuestionCard.jsx'
import ScoreScreen from '../components/ScoreScreen.jsx'
import { PrabhupadaLogoWithFallback } from '../components/PrabhupadaLogo.jsx'

export default function Quiz() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [step, setStep] = useState('name') // 'name' | 'quiz' | 'result'
  const [name, setName] = useState('')
  const [answers, setAnswers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  // Audio gate: track the furthest point reached (rewinding won't reset it)
  const [maxFraction, setMaxFraction] = useState(0)
  const UNLOCK_THRESHOLD = 0.9 // 90% of audio must be reached
  const audioUnlocked = maxFraction >= UNLOCK_THRESHOLD

  function handleAudioProgress(currentTime, duration) {
    if (!duration) return
    const fraction = currentTime / duration
    setMaxFraction(prev => Math.max(prev, fraction))
  }

  const startTimeRef = useRef(null)

  useEffect(() => {
    fetch(`/api/quizzes/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setQuiz(data)
        setAnswers(new Array(data.questions.length).fill(-1))
        setLoading(false)
      })
      .catch(() => { setError('Failed to load quiz.'); setLoading(false) })
  }, [id])

  function handleStartQuiz() {
    if (!name.trim()) return
    startTimeRef.current = Date.now()
    setStep('quiz')
  }

  async function handleSubmit() {
    if (answers.some(a => a === -1)) return
    setSubmitting(true)
    const timeTakenSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)
    try {
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: id, name: name.trim(), answers, timeTakenSeconds })
      })
      const data = await res.json()
      setResult(data)
      setStep('result')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      alert('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const allAnswered = answers.length > 0 && answers.every(a => a !== -1)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">😔</div>
          <p className="text-gray-700 font-medium mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="text-orange-500 underline text-sm">
            ← Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white px-4 pt-10 pb-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-white/80 hover:text-white text-xl">‹</button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <PrabhupadaLogoWithFallback size="sm" />
              <span className="font-bold text-base truncate">Srila Prabhupada Quiz</span>
            </div>
            <p className="text-orange-100 text-xs truncate">{quiz.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Name entry */}
        {step === 'name' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-5xl mb-4">🙏</div>
            <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">Welcome, Devotee!</h2>
            <p className="text-gray-500 text-sm text-center mb-6">Please enter your first name to begin</p>
            <div className="w-full max-w-sm space-y-4">
              <input
                type="text"
                placeholder="Your first name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStartQuiz()}
                className="w-full p-4 border-2 border-orange-200 rounded-xl text-center text-lg focus:outline-none focus:border-orange-500"
                autoFocus
                maxLength={50}
              />
              <button
                onClick={handleStartQuiz}
                disabled={!name.trim()}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold rounded-xl text-lg shadow-md disabled:opacity-40 transition-all active:scale-95"
              >
                Start Quiz →
              </button>
            </div>
          </div>
        )}

        {/* Quiz */}
        {step === 'quiz' && (
          <>
            <AudioPlayer src={quiz.blobUrl} title={quiz.title} onProgress={handleAudioProgress} />

            {/* Listening progress gate */}
            {!audioUnlocked && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 font-medium text-center mb-3">
                  🎧 Listen to the lecture to unlock the questions
                </p>
                <div className="w-full bg-amber-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(maxFraction * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-amber-600 text-center mt-2">
                  {Math.round(maxFraction * 100)}% listened · {Math.round(UNLOCK_THRESHOLD * 100)}% required to unlock
                </p>
              </div>
            )}

            {audioUnlocked && (
              <div className="mt-4 mb-5 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
                <p className="text-sm text-green-700 font-medium">✅ Questions unlocked — answer below</p>
              </div>
            )}

            {/* Questions — only interactive when unlocked */}
            <div className={`mt-4 transition-opacity duration-500 ${audioUnlocked ? 'opacity-100' : 'opacity-30 pointer-events-none select-none'}`}>
              {quiz.questions.map((q, i) => (
                <QuestionCard
                  key={i}
                  question={q}
                  index={i}
                  selected={answers[i]}
                  onSelect={val => {
                    const next = [...answers]
                    next[i] = val
                    setAnswers(next)
                  }}
                />
              ))}

              <div className="mt-2 mb-2 text-center text-xs text-gray-400">
                {answers.filter(a => a !== -1).length} of {quiz.questions.length} answered
              </div>

              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting || !audioUnlocked}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold rounded-xl text-lg shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : 'Submit Answers'}
              </button>

              {audioUnlocked && !allAnswered && (
                <p className="text-center text-xs text-gray-400 mt-2">
                  Please answer all questions to submit.
                </p>
              )}
            </div>
          </>
        )}

        {/* Result */}
        {step === 'result' && result && (
          <ScoreScreen
            score={result.score}
            totalQuestions={result.totalQuestions}
            questions={quiz.questions}
            userAnswers={result.answers}
            quizId={id}
          />
        )}
      </div>
    </div>
  )
}
