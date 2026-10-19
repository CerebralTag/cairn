import { useState } from 'react'
import { useAreas } from '../areasContext'
import { beadCaption, summariseToday } from '../beads'
import { formatMinutes } from '../goals'
import type { ActivityItem } from '../reports'

const MAX_BEADS = 60 // far more than a day needs; keeps the strip from growing without bound

// One bead per win finished today, coloured by its area (a neutral grey if it has
// none). It only ever fills in: there are no empty slots, targets or levels.
export function TodayBeads({ items, onEdit }: { items: ActivityItem[]; onEdit?: (key: string) => void }) {
  const { colourOf } = useAreas()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const summary = summariseToday(items)

  if (summary.wins.length === 0 && summary.minutes === 0) return null

  const shown = summary.wins.slice(-MAX_BEADS)
  const selected = summary.wins.find((w) => w.key === selectedKey)
  const caption = selected
    ? `${selected.title}${selected.amount !== undefined ? ` · ${selected.amount}` : ''} · ${selected.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : beadCaption(summary, formatMinutes)

  return (
    <div className="beads-strip">
      {shown.length > 0 && (
        <ul className="beads" aria-label="Wins today">
          {shown.map((win) => (
            <li key={win.key}>
              <button
                className={win.key === selectedKey ? 'bead selected' : 'bead'}
                style={{ background: win.areas[0] ? colourOf(win.areas[0]) : 'var(--color-bead-neutral)' }}
                aria-label={`${win.title}, ${win.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
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
