import { useState } from 'react'
import type { TimeEntryPatch } from '../edits'
import { isActive } from '../goals'
import { positiveNumber } from '../limits'
import { parseDateTimeInput, toDateTimeInput } from '../dates'
import type { Area, GoalDef, TimeEntry } from '../types'
import { AreaChips } from './AreaChips'

export type { TimeEntryPatch }

type Props = {
  entry: TimeEntry
  attachedTo?: string // the task title, when the entry belongs to a task
  goals: GoalDef[]
  onSave: (patch: TimeEntryPatch) => void
  onCancel: () => void
  onDelete?: () => void
}

// Edit a logged block of time. An entry attached to a task takes its title, goals
// and areas from the task, so only the minutes and the time can change here.
export function TimeEntryForm({ entry, attachedTo, goals, onSave, onCancel, onDelete }: Props) {
  const [now] = useState(() => new Date())
  const [minutes, setMinutes] = useState(String(entry.minutes))
  const [when, setWhen] = useState(toDateTimeInput(entry.at))
  const [title, setTitle] = useState(entry.title ?? '')
  const [areas, setAreas] = useState<Area[]>(entry.areas)
  const [goalIds, setGoalIds] = useState<string[]>(entry.goalIds)
  const [error, setError] = useState<string | null>(null)

  const standalone = entry.winId === undefined
  const leafGoals = goals.filter((g) => !g.childIds && isActive(g))

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsedMinutes = positiveNumber(minutes)
    if (parsedMinutes === undefined) return setError('Enter the number of minutes.')
    const parsedWhen = parseDateTimeInput(when)
    if (!parsedWhen) return setError('Pick a date and time.')
    if (parsedWhen.getTime() > Date.now() + 60_000) return setError('Pick a time that has already happened.')
    onSave({
      minutes: Math.round(parsedMinutes),
      at: parsedWhen,
      title: standalone ? title.trim() || undefined : entry.title,
      areas,
      goalIds,
    })
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      {standalone ? (
        <input placeholder="What was it? (optional)" aria-label="What was it? (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      ) : (
        <p className="muted">Part of “{attachedTo ?? 'a task'}”.</p>
      )}

      <div className="two-up">
        <input type="number" min="1" placeholder="Minutes" aria-label="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <span />
      </div>

      <label className="field">
        <span className="muted">When it started</span>
        <input type="datetime-local" value={when} max={toDateTimeInput(now)} onChange={(e) => setWhen(e.target.value)} />
      </label>

      {standalone && (
        <>
          <div className="muted">Areas</div>
          <AreaChips value={areas} onToggle={(a) => setAreas(areas.includes(a) ? areas.filter((x) => x !== a) : [...areas, a])} />
          {leafGoals.length > 0 && (
            <fieldset className="children">
              <legend className="muted">Counts toward</legend>
              {leafGoals.map((g) => (
                <label key={g.id}>
                  <input
                    type="checkbox"
                    checked={goalIds.includes(g.id)}
                    onChange={() => setGoalIds(goalIds.includes(g.id) ? goalIds.filter((x) => x !== g.id) : [...goalIds, g.id])}
                  />
                  {g.title}
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}

      {error && (
        <p className="muted" role="alert">
          {error}
        </p>
      )}

      <div className="form-buttons">
        <button type="submit" className="primary">
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button type="button" className="link" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </form>
  )
}
