import { useState } from 'react'
import type { WinValues } from '../edits'
import { isLinkable } from '../goals'
import { MAX_NUMBER, positiveNumber } from '../limits'
import { parseDateTimeInput, toDateTimeInput } from '../dates'
import type { Area, GoalDef } from '../types'
import type { Suggestion } from '../suggest'
import { AreaChips } from './AreaChips'
import { TitleInput } from './TitleInput'

export type { WinValues }

type Props = {
  goals: GoalDef[]
  initial?: Partial<WinValues>
  withMinutes?: boolean // ad-hoc wins can record time; tasks get sessions instead
  withWhen?: boolean // let the time be set, so something forgotten can be logged later
  submitLabel?: string
  onSave: (values: WinValues) => void
  onCancel: () => void
  onDelete?: () => void // offered when fixing an entry that already exists
}

// Used for logging an ad-hoc win, adding a to-do, and editing either. Areas and
// goals are independent, optional links; picking an area just pre-ticks the
// goals in that area to save taps.
export function WinForm({
  goals,
  initial,
  withMinutes = false,
  withWhen = false,
  submitLabel = 'Save',
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const [now] = useState(() => new Date())
  const [title, setTitle] = useState(initial?.title ?? '')
  const [areas, setAreas] = useState<Area[]>(initial?.areas ?? [])
  const [goalIds, setGoalIds] = useState<string[]>(initial?.goalIds ?? [])
  const [minutes, setMinutes] = useState('')
  const [when, setWhen] = useState(toDateTimeInput(initial?.at ?? now))
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '')
  const [error, setError] = useState<string | null>(null)

  const leafGoals = goals.filter(isLinkable)

  function toggleArea(area: Area) {
    if (areas.includes(area)) {
      setAreas(areas.filter((a) => a !== area))
      return
    }
    setAreas([...areas, area])
    const suggested = leafGoals.filter((g) => g.areas.includes(area)).map((g) => g.id)
    setGoalIds([...new Set([...goalIds, ...suggested])])
  }

  // Picking a name you've used before fills in what you chose then, but never over
  // anything you have already filled in yourself.
  function pickSuggestion(s: Suggestion) {
    setTitle(s.title)
    if (areas.length === 0 && s.areas.length > 0) setAreas(s.areas)
    if (goalIds.length === 0 && s.goalIds.length > 0) setGoalIds(s.goalIds)
    if (amount === '' && s.amount !== undefined) setAmount(String(s.amount))
  }

  function toggleGoal(id: string) {
    setGoalIds(goalIds.includes(id) ? goalIds.filter((g) => g !== id) : [...goalIds, id])
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault() // stop the browser's default full-page form submit
    if (title.trim() === '') return

    let at: Date | undefined
    if (withWhen) {
      const parsedWhen = parseDateTimeInput(when)
      if (!parsedWhen) return setError('Pick a date and time.')
      // A minute of slack so "now" is never rejected by the clock ticking on.
      if (parsedWhen.getTime() > Date.now() + 60_000) return setError('Pick a time that has already happened.')
      at = parsedWhen
    }

    const parsedMinutes = positiveNumber(minutes)
    const parsedAmount = positiveNumber(amount)
    onSave({
      title: title.trim(),
      areas,
      goalIds,
      minutes: parsedMinutes,
      at,
      amount: parsedAmount,
    })
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <TitleInput autoFocus placeholder="What did you do?" value={title} onChange={setTitle} onPick={pickSuggestion} />

      {withWhen && (
        <label className="field">
          <span className="muted">When</span>
          <input
            type="datetime-local"
            value={when}
            max={toDateTimeInput(now)}
            onChange={(e) => {
              setWhen(e.target.value)
              setError(null)
            }}
          />
        </label>
      )}

      <div className="muted">Areas</div>
      <AreaChips value={areas} onToggle={toggleArea} />

      {leafGoals.length > 0 && (
        <fieldset className="children">
          <legend className="muted">Counts toward</legend>
          {leafGoals.map((g) => (
            <label key={g.id}>
              <input type="checkbox" checked={goalIds.includes(g.id)} onChange={() => toggleGoal(g.id)} />
              {g.title}
            </label>
          ))}
        </fieldset>
      )}

      <input
        type="number"
        min="1"
        max={MAX_NUMBER}
        placeholder="Amount (optional, like 10)"
        aria-label="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      {withMinutes && (
        <input
          type="number"
          min="1"
          max={MAX_NUMBER}
          placeholder="Minutes (optional)" aria-label="Minutes (optional)"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
      )}

      {error && (
        <p className="muted" role="alert">
          {error}
        </p>
      )}

      <div className="form-buttons">
        <button type="submit" className="primary">
          {submitLabel}
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
