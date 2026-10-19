import { useState } from 'react'
import { positiveNumber } from '../limits'
import { soFarLabel } from '../reports'
import type { GoalDef, TimeEntry, Win } from '../types'
import { WinForm, type WinValues } from './WinForm'

type Props = {
  tasks: Win[] // unfinished only (todo / doing)
  goals: GoalDef[]
  timeEntries: TimeEntry[]
  onComplete: (id: string) => void
  onAdd: (values: WinValues) => void
  onEdit: (id: string, values: WinValues) => void
  onAddSession: (id: string, minutes: number) => void
  onSeeAll: () => void // link out to the full task list under Manage
  timerRunning: boolean
  onStartTimer: (task: Win) => void
}

// Plain to-do list: no due dates, no overdue, just to do / done. Work on a task
// is recorded as sessions, shown as "so far"; finishing it makes it a win.
export function TodoList({ tasks, goals, timeEntries, onComplete, onAdd, onEdit, onAddSession, onSeeAll, timerRunning, onStartTimer }: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState('')

  function submitSession(event: React.FormEvent) {
    event.preventDefault()
    const parsed = positiveNumber(minutes)
    if (sessionId && parsed !== undefined) onAddSession(sessionId, parsed)
    setSessionId(null)
    setMinutes('')
  }

  return (
    <section className="card">
      <h2>To do</h2>
      <ul className="list">
        {tasks.map((task) => {
          if (editingId === task.id) {
            return (
              <li key={task.id}>
                <div className="grow">
                  <WinForm
                    goals={goals}
                    initial={task}
                    onSave={(values) => {
                      onEdit(task.id, values)
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              </li>
            )
          }
          const soFar = soFarLabel(task.id, timeEntries)
          return (
            <li key={task.id}>
              <input type="checkbox" checked={false} onChange={() => onComplete(task.id)} aria-label={`Finish ${task.title}`} />
              <div className="grow">
                <div>{task.title}</div>
                {(soFar || task.amount !== undefined) && (
                  <div className="muted">{[task.amount !== undefined ? String(task.amount) : null, soFar].filter(Boolean).join(' · ')}</div>
                )}
                {sessionId === task.id && (
                  <form className="session-form" onSubmit={submitSession}>
                    <input
                      autoFocus
                      type="number"
                      min="1"
                      placeholder="Minutes worked" aria-label="Minutes worked"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                    />
                    <button type="submit" className="link">
                      Add
                    </button>
                  </form>
                )}
              </div>
              {!timerRunning && (
                <button className="link" aria-label={`Start timer for ${task.title}`} onClick={() => onStartTimer(task)}>
                  ▶ Timer
                </button>
              )}
              <button className="link" onClick={() => setSessionId(sessionId === task.id ? null : task.id)}>
                + Time
              </button>
              <button className="link" onClick={() => setEditingId(task.id)}>
                Edit
              </button>
            </li>
          )
        })}
        {tasks.length === 0 && <li className="muted">Nothing waiting. Add something when it comes to mind.</li>}
      </ul>

      {adding ? (
        <WinForm
          goals={goals}
          onSave={(values) => {
            onAdd(values)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="todo-footer">
          <button className="link" onClick={() => setAdding(true)}>
            + Add a task
          </button>
          <button className="link" onClick={onSeeAll}>
            All tasks →
          </button>
        </div>
      )}
    </section>
  )
}
