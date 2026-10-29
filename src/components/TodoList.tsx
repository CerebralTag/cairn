import { useState } from 'react'
import { positiveNumber } from '../limits'
import { soFarLabel } from '../reports'
import { matchesSearch } from '../todoSearch'
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
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false) // starts collapsed: a list of open things is not what Today leads with
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

  // The search box shows while collapsed. Typing opens the list, filtered; clearing it closes the list again.
  const searching = query.trim() !== ''
  const expanded = open || searching
  const shown = searching ? tasks.filter((t) => matchesSearch(t, query)) : tasks

  function search(value: string) {
    setQuery(value)
    if (value.trim() === '') setOpen(false)
  }

  function toggle() {
    if (expanded) {
      setOpen(false)
      setQuery('')
    } else setOpen(true)
  }

  return (
    <section className="card">
      <div className="todo-head">
        <button className="section-toggle" aria-expanded={expanded} onClick={toggle}>
          <h2>
            To do <span className="muted">{shown.length}</span>
          </h2>
          <span className="muted">{expanded ? 'Hide' : 'Show'}</span>
        </button>
        {/* Adding is always one tap away, whether or not the list is open. */}
        {!adding && (
          <button className="link" onClick={() => setAdding(true)}>
            + Add
          </button>
        )}
      </div>
      {adding && (
        <WinForm
          goals={goals}
          onSave={(values) => {
            onAdd(values)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {tasks.length > 0 && (
        <input
          className="todo-search"
          type="search"
          placeholder="Search to-dos"
          aria-label="Search to-dos"
          value={query}
          onChange={(e) => search(e.target.value)}
        />
      )}
      {expanded && (
        <>
          <ul className="list">
            {shown.map((task) => {
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
            {shown.length === 0 && (
              <li className="muted">{tasks.length === 0 ? 'Nothing waiting. Add something when it comes to mind.' : 'Nothing matches that.'}</li>
            )}
          </ul>

          <div className="todo-footer">
            <button className="link" onClick={onSeeAll}>
              All tasks →
            </button>
          </div>
        </>
      )}
    </section>
  )
}
