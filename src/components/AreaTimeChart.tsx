import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { useAreas } from '../areasContext'
import { formatMinutes } from '../goals'
import { NEUTRAL_COLOUR } from '../areas'
import { OTHER_AREA, type AreaTotal } from '../reports'

// Time by area: one horizontal bar per area that has timed entries.
export function AreaTimeChart({
  totals,
  title = 'Time by area',
  hideWhenEmpty = false,
}: {
  totals: AreaTotal[]
  title?: string
  hideWhenEmpty?: boolean // no box at all when nothing is timed (Today), instead of a note (History)
}) {
  const { colourOf, nameOf } = useAreas()
  const timed = totals
    .filter((t) => t.minutes > 0)
    .map((t) =>
      t.area === OTHER_AREA
        ? { name: 'Other', colour: NEUTRAL_COLOUR, minutes: t.minutes } // time that belongs to no area
        : { name: nameOf(t.area), colour: colourOf(t.area), minutes: t.minutes },
    )

  if (hideWhenEmpty && timed.length === 0) return null

  return (
    <section className="card">
      <h2>{title}</h2>
      {timed.length === 0 ? (
        <p className="muted">No timed entries in this range yet.</p>
      ) : (
        <div role="img" aria-label={`Time by area: ${timed.map((t) => `${t.name} ${formatMinutes(t.minutes)}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height={timed.length * 36 + 8}>
            <BarChart data={timed} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--color-text)', fontSize: 13 }}
              />
              <Bar dataKey="minutes" maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {timed.map((t) => (
                  <Cell key={t.name} fill={t.colour} />
                ))}
                <LabelList
                  dataKey="minutes"
                  position="right"
                  fill="var(--color-text)"
                  fontSize={12}
                  formatter={(value) => formatMinutes(Number(value))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
