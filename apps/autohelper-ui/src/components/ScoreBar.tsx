interface ScoreBarProps {
  score: number
  variant?: 'inline' | 'detail'
}

function level(pct: number): string {
  if (pct >= 80) return 'high'
  if (pct >= 40) return 'mid'
  return 'low'
}

export function ScoreBar({ score, variant = 'inline' }: ScoreBarProps) {
  const pct = Math.round(score * 100)
  const lvl = level(pct)

  if (variant === 'detail') {
    return (
      <div class="detail-score-bar">
        <div class={`detail-score-fill score-${lvl}`} style={{ width: `${pct}%` }} />
      </div>
    )
  }

  return (
    <span class="score-cell">
      <span class="score-bar">
        <span class={`score-fill score-${lvl}`} style={{ width: `${pct}%` }} />
      </span>
      <span class="score-pct">{pct}%</span>
    </span>
  )
}
