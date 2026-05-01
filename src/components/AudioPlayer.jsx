import { useRef, useState } from 'react'

export default function AudioPlayer({ src, title, onProgress }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  function fmt(s) {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function togglePlay() {
    const a = audioRef.current
    if (!a) return
    playing ? a.pause() : a.play()
  }

  function handleSeek(e) {
    const a = audioRef.current
    if (!a || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    a.currentTime = ratio * duration
  }

  return (
    <div className="w-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-lg">🎵</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-snug truncate">{title}</p>
          <p className="text-xs text-orange-500">Srila Prabhupada Lecture</p>
        </div>
      </div>

      {/* Seek bar */}
      <div
        className="w-full h-2 bg-orange-100 rounded-full mb-3 cursor-pointer relative overflow-hidden"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-white flex items-center justify-center shadow-md active:scale-95 transition-all flex-shrink-0"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <span className="text-xs text-gray-500 tabular-nums">
          {fmt(audioRef.current?.currentTime)} / {fmt(duration)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); onProgress?.(duration, duration) }}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onTimeUpdate={e => {
          const a = e.target
          if (a.duration) {
            setProgress((a.currentTime / a.duration) * 100)
            onProgress?.(a.currentTime, a.duration)
          }
        }}
      />
    </div>
  )
}
