import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { useAreas } from '../areasContext'
import { progressLabel } from '../goals'
import type { GoalPeriod } from '../types'
import { goalHistory, type DateRange } from '../reports'
import type { AppData } from '../types'

type Point = { label: string; heading: string; percent: number; check: string; detail: string }

function labelFor(period: GoalPeriod, date: Date): { label: string; heading: string } {
  if (period === 'month') {
    const month = date.toLocaleDateString([], { month: 'short' })
    return { label: month, heading: date.toLocaleDateString([], { month: 'long', year: 'numeric' }) }
  }
  const day = date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return { label: day, heading: period === 'week' ? `Week of ${day}` : date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) }
}

function PeriodTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as Point
  return (
    <div className="tooltip">
      <strong>{point.heading}</strong>
      <div>{point.detail}</div>
    </div>
  )
}

// Neutral goal history: every week is a bar, weeks that hit the target get a
// check, weeks below target get no mark (no red, no "missed").
export function GoalHistoryChart({ appData, range }: { appData: AppData; range: DateRange }) {
  const { goalColour } = useAreas()
  const leafGoals = appData.goals.filter((g) => !g.childIds)

  return (
    <section className="card">
      <h2>Goal history</h2>
      {leafGoals.map((goal) => {
        const colour = goalColour(goal)
        const history = goalHistory(goal, appData, range)
        if (history.length === 0) return null // archived before this range began
        const data: Point[] = history.map((r) => ({
          ...labelFor(goal.period, r.periodStart),
          percent: Math.round(r.progress.fraction * 100),
          check: r.progress.met ? '✓' : '',
          detail: progressLabel(goal, r.progress),
        }))
        return (
          <div key={goal.id} className="goal-chart">
            <div className="goal-chart-title">
              <span className="dot" style={{ background: colour }} />
              {goal.title}
              {goal.archivedAt && <span className="muted"> · archived</span>}
            </div>
            <div
              role="img"
              aria-label={`${goal.title}: target reached in ${history.filter((r) => r.progress.met).length} of ${history.length} ${{ day: 'days', week: 'weeks', month: 'months' }[goal.period]}`}
            >
              <ResponsiveContainer width="100%" height={96}>
                <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: 4 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip content={PeriodTooltip} cursor={false} />
                  <Bar
                    dataKey="percent"
                    fill={colour}
                    maxBarSize={24}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  >
                    <LabelList dataKey="check" position="top" fill="var(--color-text)" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })}
    </section>
  )
}
