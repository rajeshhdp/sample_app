const LABELS = ['A', 'B', 'C', 'D']

export default function QuestionCard({ question, index, selected, onSelect, disabled }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4 mb-4">
      <p className="font-semibold text-gray-800 mb-3 leading-snug">
        <span className="text-saffron-700 mr-1">{index + 1}.</span> {question.question}
      </p>
      <div className="space-y-2">
        {question.options.map((option, i) => (
          <button
            key={i}
            onClick={() => !disabled && onSelect(i)}
            disabled={disabled}
            className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border-2 transition-all tap-target
              ${disabled ? 'cursor-default' : 'cursor-pointer hover:border-orange-400'}
              ${selected === i
                ? 'border-orange-500 bg-orange-50 font-medium'
                : 'border-gray-200 bg-gray-50'}
            `}
          >
            <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
              ${selected === i ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}
            `}>
              {LABELS[i]}
            </span>
            <span className="text-sm leading-snug">{option}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
