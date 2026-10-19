import { useState } from 'react'
import { useAreas } from '../areasContext'
import { formatMinutes } from '../goals'
import { logEntries, startOfDay, type DateRange, type LogEntry } from '../reports'
import type { AppData } from '../types'
import { TimeEntryForm, type TimeEntryPatch } from './TimeEntryForm'
import { WinForm, type WinValues } from './WinForm'

export type LogHandlers = {
  onEditWin: (id: string, values: WinValues) => void
  onDeleteWin: (id: string) => void
  onUpdateEntry: (id: string, patch: TimeEntryPatch) => void
  onDeleteEntry: (id: string) => void
}

type Props = LogHandlers & {
  data: AppData
  range: DateRange
  title: string
  onBack: () => void
}

function dayHeading(day: Date): string {
  return day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

// Every record in a range, one row each, so any of them can be corrected or removed.
export function LogScreen({ data, range, title, onBack, onEditWin, onDeleteWin, onUpdateEntry, onDeleteEntry }: Props) {
  const { colourOf } = useAreas()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const rows = logEntries(data, range)

  // Group by calendar day, keeping the newest-first order.
  const days: { day: Date; rows: LogEntry[] }[] = []
  for (const row of rows) {
    const day = startOfDay(row.at)
    const last = days[days.length - 1]
    if (last && last.day.getTime() === day.getTime()) last.rows.push(row)
    else days.push({ day, rows: [row] })
  }

  function remove(row: LogEntry) {
    const what = row.kind === 'win' ? `“${row.title}”` : `${formatMinutes(row.minutes ?? 0)} of “${row.title}”`
    const note = row.kind === 'win' ? ' Time logged on it is kept.' : ''
    if (!window.confirm(`Delete ${what}?${note}`)) return
    if (row.kind === 'win') onDeleteWin(row.id)
    else onDeleteEntry(row.id)
  }

  function editor(row: LogEntry) {
    if (row.kind === 'win') {
      const win = data.wins.find((w) => w.id === row.id)
      if (!win) return null
      return (
        <WinForm
          goals={data.goals}
          initial={{ title: win.title, areas: win.areas, goalIds: win.goalIds, at: win.completedAt, amount: win.amount }}
          withWhen
          onSave={(values) => {
            onEditWin(row.id, values)
            setEditingKey(null)
          }}
          onCancel={() => setEditingKey(null)}
        />
      )
    }
    const entry = data.timeEntries.find((e) => e.id === row.id)
    if (!entry) return null
    return (
      <TimeEntryForm
        entry={entry}
        attachedTo={row.attachedTo}
        goals={data.goals}
        onSave={(patch) => {
          onUpdateEntry(row.id, patch)
          setEditingKey(null)
        }}
        onCancel={() => setEditingKey(null)}
      />
    )
  }

  return (
    <main className="home">
      <button className="link back" onClick={onBack}>
        ← History
      </button>
      <h1>Log</h1>
      <p className="muted">{title}</p>

      {days.length === 0 && (
        <section className="card">
          <p className="muted">Nothing logged in this range.</p>
        </section>
      )}

      {days.map(({ day, rows: dayRows }) => (
        <section className="card" key={day.getTime()}>
          <h2>{dayHeading(day)}</h2>
          <ul className="list">
            {dayRows.map((row) =>
              editingKey === row.key ? (
                <li key={row.key}>
                  <div className="grow">{editor(row)}</div>
                </li>
              ) : (
                <li key={row.key}>
                  <span className="dot" style={{ background: colourOf(row.areas[0]) }} />
                  <div className="grow">
                    <div>{row.title}</div>
                    <div className="muted">
                      {row.kind === 'time'
                        ? `${formatMinutes(row.minutes ?? 0)}${row.attachedTo && row.attachedTo !== row.title ? ` · ${row.attachedTo}` : ''}`
                        : row.amount !== undefined
                          ? String(row.amount)
                          : 'Win'}
                      {' · '}
                      {row.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <button className="link" onClick={() => setEditingKey(row.key)}>
                    Edit
                  </button>
                  <button className="link" onClick={() => remove(row)}>
                    Delete
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </main>
  )
}
