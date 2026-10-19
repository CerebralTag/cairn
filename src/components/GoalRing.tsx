import { useAreas } from '../areasContext'
import { PERIOD_WORDS, progressLabel } from '../goals'
import type { GoalDef, GoalProgress } from '../types'

const RADIUS = 34
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// A circular progress ring drawn with SVG. The coloured arc is a circle whose
// stroke is dashed: "dash length" = the filled part, the rest is gap.
export function GoalRing({ goal, progress }: { goal: GoalDef; progress: GoalProgress }) {
  const { goalColour } = useAreas()
  const filled = progress.fraction * CIRCUMFERENCE
  const colour = goalColour(goal)

  return (
    <div className="ring">
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="var(--color-ring-track)" strokeWidth="8" />
        {filled > 0 && (
          // A zero-length arc with round caps would still draw a dot, so skip it.
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            stroke={colour}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            transform="rotate(-90 40 40)"
          />
        )}
        <text x="40" y="45" textAnchor="middle" fontSize="16" fill="var(--color-text)">
          {progress.met ? '✓' : `${Math.round(progress.fraction * 100)}%`}
        </text>
      </svg>
      <div className="ring-title">{goal.title}</div>
      <div className="muted">{progressLabel(goal, progress)}</div>
      <div className="muted period">{PERIOD_WORDS[goal.period].this}</div>
    </div>
  )
}
