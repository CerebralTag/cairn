import { useAreas } from '../areasContext'
import { PERIOD_WORDS, childrenFor, periodStartFor, progressFor, progressLabel } from '../goals'
import type { AppData, GoalDef } from '../types'

// An overarching goal: one segment per child goal, each filled by that child's own
// progress. Met (✓) only when every segment is full.
export function OverallCard({ goal, data, now }: { goal: GoalDef; data: AppData; now: Date }) {
  const { goalColour } = useAreas()
  const start = periodStartFor(goal.period, now)
  const progress = progressFor(goal, data, start)
  const children = childrenFor(goal, data.goals, start)
  if (children.length === 0) return null // everything it included is gone: nothing to show

  return (
    <section className="card overall-card" aria-label={goal.title}>
      <div className="overall-head">
        <strong>{goal.title}</strong>
        <span className="muted">
          {progress.met ? '✓ ' : ''}
          {progressLabel(goal, progress)} · {PERIOD_WORDS[goal.period].this}
        </span>
      </div>
      <div className="segments" role="img" aria-label={`${Math.round(progress.fraction * 100)}% overall`}>
        {children.map((child) => {
          const p = progressFor(child, data, start)
          return (
            <span key={child.id} className="segment" title={`${child.title}: ${progressLabel(child, p)}`}>
              <span className="segment-fill" style={{ width: `${p.fraction * 100}%`, background: goalColour(child) }} />
            </span>
          )
        })}
      </div>
    </section>
  )
}
