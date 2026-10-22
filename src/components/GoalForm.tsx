import { useState } from 'react'
import { positiveNumber } from '../limits'
import { PERIOD_WORDS, currentTarget, formatMinutes, goalSource, isActive, isTracked, withTarget } from '../goals'
import type { Area, GoalDef, GoalPeriod, GoalSource } from '../types'
import { AreaChips } from './AreaChips'

type GoalType = 'time' | 'count' | 'amount' | 'routine' | 'overarching'

type Props = {
  initial?: GoalDef // present = editing
  allGoals: GoalDef[]
  onSave: (goal: GoalDef, backfill: boolean) => void
  onCancel: () => void
}

function typeOf(goal: GoalDef): GoalType {
  if (goal.childIds) return 'overarching'
  if (goalSource(goal) === 'each') return 'routine' // stored as a count goal that counts its tagged tasks
  return goal.kind as 'time' | 'count' | 'amount'
}

// Title, areas, target and included goals can all be edited. The type (time vs
// count) and the period (day, week, month) are fixed once created, because past
// targets are stored in that unit and length.
// Editing areas is safe: progress comes from explicit links, not from areas.
export function GoalForm({ initial, allGoals, onSave, onCancel }: Props) {
  const now = new Date()
  const editing = initial !== undefined
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<GoalType>(initial ? typeOf(initial) : 'time')
  const [period, setPeriod] = useState<GoalPeriod>(initial?.period ?? 'week')
  const [source, setSource] = useState<GoalSource>(initial?.source ?? 'linked')
  const [areas, setAreas] = useState<Area[]>(initial?.areas ?? [])
  const [tracked, setTracked] = useState(initial ? isTracked(initial) : true) // routines only
  const [backfill, setBackfill] = useState(false)
  const [amount, setAmount] = useState(() => {
    if (!initial || initial.childIds) return ''
    const target = currentTarget(initial, now)
    return String(initial.kind === 'time' ? target / 60 : target)
  })
  const [childIds, setChildIds] = useState<string[]>(initial?.childIds ?? [])

  // An overarching goal can only include goals that repeat on the same schedule as it.
  const candidates = allGoals.filter((g) => !g.childIds && g.id !== initial?.id && isActive(g) && isTracked(g) && g.period === period)
  const parsed = positiveNumber(amount) ?? 0 // 0 means "not a usable number"
  const eachRule = type === 'routine' // the target is however many tasks are tagged
  const valid =
    title.trim() !== '' &&
    (type === 'overarching' ? childIds.length > 0 : eachRule || parsed > 0)

  function toggleArea(area: Area) {
    setAreas(areas.includes(area) ? areas.filter((a) => a !== area) : [...areas, area])
  }

  function toggleChild(id: string) {
    setChildIds(childIds.includes(id) ? childIds.filter((c) => c !== id) : [...childIds, id])
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return

    if (type === 'overarching') {
      onSave(
        {
          ...(initial ?? { id: crypto.randomUUID(), kind: 'completion' as const, period, targets: [] }),
          title: title.trim(),
          areas,
          childIds,
        },
        false,
      )
      return
    }

    // Time targets are typed in hours but stored as minutes.
    const target = eachRule ? 0 : type === 'time' ? Math.round(parsed * 60) : Math.round(parsed) // the real number is set from the tagged tasks
    const base: GoalDef = initial ?? { id: crypto.randomUUID(), title: '', areas: [], kind: type === 'routine' ? 'count' : type, period, targets: [] }
    // 'linked' is the default and is stored as no value at all. Amount goals always count linked wins.
    // A routine is a count goal that counts its tagged tasks; one kept as a container has no areas.
    const rule: GoalSource = type === 'routine' ? 'each' : type === 'count' || type === 'time' ? source : 'linked'
    const updated: GoalDef = {
      ...base,
      title: title.trim(),
      areas: type === 'routine' && !tracked ? [] : areas,
      source: rule === 'linked' ? undefined : rule,
      tracked: type === 'routine' && !tracked ? false : undefined,
    }
    // Only changed when the target differs, so unrelated edits don't add history rows.
    const unchanged = initial && currentTarget(initial, now) === target
    const linkExisting = !editing && backfill && areas.length > 0 && rule === 'linked'
    onSave(unchanged ? updated : withTarget(updated, target, now), linkExisting)
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <input autoFocus placeholder="Goal name" aria-label="Goal name" value={title} onChange={(e) => setTitle(e.target.value)} />

      <div className="two-up">
        <select
          value={type}
          disabled={editing}
          onChange={(e) => {
            setType(e.target.value as GoalType)
            setSource('linked') // the choices differ by type, so start from the default
          }}
          aria-label="Goal type"
        >
          <option value="time">Time</option>
          <option value="count">Count</option>
          <option value="amount">Amount (adds up a number, like 100)</option>
          <option value="routine">Routine (repeatable tasks)</option>
          <option value="overarching">Overarching (all its goals met)</option>
        </select>
        <select
          value={period}
          disabled={editing}
          aria-label="How often"
          onChange={(e) => {
            setPeriod(e.target.value as GoalPeriod)
            setChildIds([]) // the included goals must match the new schedule
          }}
        >
          <option value="day">Per day</option>
          <option value="week">Per week</option>
          <option value="month">Per month</option>
        </select>
      </div>

      {(type === 'count' || type === 'time') && (
        <label className="field">
          <span className="muted">What counts</span>
          <select
            value={source}
            disabled={editing}
            aria-label="What counts"
            onChange={(e) => setSource(e.target.value as GoalSource)}
          >
            {type === 'count' ? (
              <>
                <option value="linked">Tasks I link to it</option>
                <option value="any">Anything I finish</option>
                <option value="todo">To-dos I finish</option>
                <option value="quick">Repeatable tasks I tap</option>
              </>
            ) : (
              <>
                <option value="linked">Time on things I link to it</option>
                <option value="any">All the time I log</option>
              </>
            )}
          </select>
          {editing && <span className="muted">Fixed once created, because it decides what every past period counted.</span>}
        </label>
      )}

      {eachRule && (
        <label className="check-row">
          <input type="checkbox" checked={tracked} onChange={(e) => setTracked(e.target.checked)} />
          Track this routine
        </label>
      )}
      {(!eachRule || tracked) && <AreaChips value={areas} onToggle={toggleArea} label="Areas (label and colour)" />}

      {eachRule && (
        <p className="muted">
          {tracked
            ? `Counts toward its areas. Met when every repeatable task tagged to it has had what it needs ${PERIOD_WORDS[period].per.replace('per ', 'each ')}.`
            : 'Just a container: it groups its repeatable tasks on Today. It is not counted toward any area, goal or history.'}{' '}
          Tag the tasks in Manage under Repeatable tasks.
        </p>
      )}

      {type !== 'overarching' && !eachRule && (
        <>
          <input
            type="number"
            min="0"
            step={type === 'time' ? '0.25' : '1'}
            placeholder={type === 'time' ? `Hours ${PERIOD_WORDS[period].per}` : type === 'amount' ? `Amount ${PERIOD_WORDS[period].per}` : `Times ${PERIOD_WORDS[period].per}`}
            aria-label="Target"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {editing && initial && (
            <p className="muted">
              Target changes apply from {PERIOD_WORDS[period].this}; earlier periods keep their old target (now{' '}
              {initial.kind === 'time' ? formatMinutes(currentTarget(initial, now)) : currentTarget(initial, now)}).
            </p>
          )}
          {!editing && areas.length > 0 && (type === 'count' ? source === 'linked' : type === 'time' ? source === 'linked' : true) && (
            <label className="check-row">
              <input type="checkbox" checked={backfill} onChange={(e) => setBackfill(e.target.checked)} />
              Also count my past entries in these areas toward this goal
            </label>
          )}
        </>
      )}

      {type === 'overarching' && (
        <fieldset className="children">
          <legend className="muted">Included goals</legend>
          {candidates.length === 0 && <p className="muted">No {{ day: 'daily', week: 'weekly', month: 'monthly' }[period]} goals to include yet.</p>}
          {candidates.map((g) => (
            <label key={g.id}>
              <input type="checkbox" checked={childIds.includes(g.id)} onChange={() => toggleChild(g.id)} />
              {g.title}
            </label>
          ))}
        </fieldset>
      )}

      <div className="form-buttons">
        <button type="submit" className="primary" disabled={!valid}>
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
