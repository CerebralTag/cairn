import { useState } from 'react'
import { isLinkable } from '../goals'
import type { TimerInput } from '../timer'
import type { Area, GoalDef, Win } from '../types'
import type { Suggestion } from '../suggest'
import { AreaChips } from './AreaChips'
import { TitleInput } from './TitleInput'

export type TimerStart = TimerInput

type Props = {
  goals: GoalDef[]
  tasks: Win[] // open tasks the timer can be attached to
  onStart: (start: TimerStart) => void
  onCancel: () => void
}

// Choose what the timer is for: an existing task (it then counts toward that
// task's goals and areas) or something standalone with its own title and links.
export function TimerStarter({ goals, tasks, onStart, onCancel }: Props) {
  const [taskId, setTaskId] = useState('')
  const [title, setTitle] = useState('')
  const [areas, setAreas] = useState<Area[]>([])
  const [goalIds, setGoalIds] = useState<string[]>([])

  const leafGoals = goals.filter(isLinkable)
  const task = tasks.find((t) => t.id === taskId)

  function toggleArea(area: Area) {
    if (areas.includes(area)) {
      setAreas(areas.filter((a) => a !== area))
      return
    }
    setAreas([...areas, area])
  }

  // Ticking a goal adds its areas; unticking leaves them.
  function toggleGoal(id: string) {
    if (goalIds.includes(id)) return setGoalIds(goalIds.filter((x) => x !== id))
    setGoalIds([...goalIds, id])
    const goalAreas = leafGoals.find((g) => g.id === id)?.areas ?? []
    setAreas([...new Set([...areas, ...goalAreas])])
  }

  function pickSuggestion(s: Suggestion) {
    setTitle(s.title)
    if (areas.length === 0 && s.areas.length > 0) setAreas(s.areas)
    if (goalIds.length === 0 && s.goalIds.length > 0) setGoalIds(s.goalIds)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (task) {
      onStart({ title: task.title, winId: task.id, areas: [], goalIds: [] })
    } else if (title.trim() !== '') {
      onStart({ title: title.trim(), areas, goalIds })
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      {tasks.length > 0 && (
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-label="Task">
          <option value="">Something else…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}

      {!task && (
        <>
          <TitleInput autoFocus placeholder="What are you doing?" value={title} onChange={setTitle} onPick={pickSuggestion} />
          <AreaChips value={areas} onToggle={toggleArea} />
          {leafGoals.length > 0 && (
            <fieldset className="children">
              <legend className="muted">Counts toward</legend>
              {leafGoals.map((g) => (
                <label key={g.id}>
                  <input
                    type="checkbox"
                    checked={goalIds.includes(g.id)}
                    onChange={() => toggleGoal(g.id)}
                  />
                  {g.title}
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}

      <div className="form-buttons">
        <button type="submit" className="primary" disabled={!task && title.trim() === ''}>
          Start
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
