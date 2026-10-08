type Props = {
  /** 0 to 100. */
  percent: number
  size?: number
  label: string
}

/** A single headline percentage drawn as a ring. The number itself is plain text. */
export default function ProgressRing({ percent, size = 88, label }: Props) {
  const clamped = Math.max(0, Math.min(100, percent))
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${clamped}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="stroke-emerald-400 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-slate-100">
        {clamped}%
      </span>
    </div>
  )
}
