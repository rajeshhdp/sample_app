export default function PrabhupadaLogo({ size = 'sm' }) {
  const dim = size === 'lg' ? 'w-16 h-16' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8'
  const fallback = size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-xl'

  return (
    <img
      src="/prabhupada.jpg"
      alt="Srila Prabhupada"
      className={`${dim} rounded-full object-cover object-top border-2 border-white/50 shadow-sm flex-shrink-0`}
      onError={e => {
        e.target.style.display = 'none'
        e.target.nextSibling.style.display = 'flex'
      }}
    />
  )
}

export function PrabhupadaLogoWithFallback({ size = 'sm' }) {
  const dim = size === 'lg' ? 'w-16 h-16' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8'
  const fallback = size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-xl'

  return (
    <span className={`${dim} flex-shrink-0 relative inline-block`}>
      <img
        src="/prabhupada.jpg"
        alt="Srila Prabhupada"
        className={`${dim} rounded-full object-cover object-top border-2 border-white/50 shadow-sm`}
        onError={e => {
          e.target.style.display = 'none'
          e.target.nextSibling.style.display = 'flex'
        }}
      />
      <span
        style={{ display: 'none' }}
        className={`${dim} rounded-full items-center justify-center ${fallback}`}
      >
        🪷
      </span>
    </span>
  )
}
