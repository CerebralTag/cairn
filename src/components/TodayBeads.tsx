import { useState } from 'react'
import { useAreas } from '../areasContext'
import { beadCaption, summariseToday } from '../beads'
import { formatMinutes } from '../goals'
import type { ActivityItem } from '../reports'

const MAX_BEADS = 150 // far more than a week needs; keeps the strip from growing without bound

// One bead per win finished today, coloured by its area (a neutral grey if it has
// none). It only ever fills in: there are no empty slots, targets or levels.
export function TodayBeads({
  items,
  onEdit,
  when = 'today',
}: {
  items: ActivityItem[]
  onEdit?: (key: string) => void
  when?: string // what the items cover: "today" or "this week" (a week shows the day with each time)
}) {
  const { colourOf } = useAreas()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const summary = summariseToday(items)
  const weekly = when !== 'today'
  const stamp = (d: Date) => d.toLocaleString([], weekly ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { hour: 'numeric', minute: '2-digit' })

  if (summary.wins.length === 0 && summary.minutes === 0) return null

  const shown = summary.wins.slice(-MAX_BEADS)
  const selected = summary.wins.find((w) => w.key === selectedKey)
  const caption = selected
    ? `${selected.title}${selected.amount !== undefined ? ` · ${selected.amount}` : ''} · ${stamp(selected.at)}`
    : beadCaption(summary, formatMinutes, when)

  return (
    <div className="beads-strip">
      {shown.length > 0 && (
        <ul className="beads" aria-label={`Wins ${when}`}>
          {shown.map((win) => (
            <li key={win.key}>
              <button
                className={win.key === selectedKey ? 'bead selected' : 'bead'}
                style={{ background: win.areas[0] ? colourOf(win.areas[0]) : 'var(--color-bead-neutral)' }}
                aria-label={`${win.title}, ${stamp(win.at)}`}
                aria-pressed={win.key === selectedKey}
                onClick={() => setSelectedKey(win.key === selectedKey ? null : win.key)}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="muted beads-caption">
        {caption}
        {selected && onEdit && (
          <button className="link" onClick={() => onEdit(selected.key)}>
            Edit
          </button>
        )}
      </div>
    </div>
  )
}
