import { useState } from 'react'
import { chipStyle } from '../areas'
import { useAreas } from '../areasContext'
import { winAreas } from '../goals'
import { positiveNumber } from '../limits'
import { soFarLabel } from '../reports'
import type { GoalDef, TimeEntry, Win } from '../types'
import { WinForm, type WinValues } from './WinForm'

const NO_AREA = '__none' // the filter for to-dos with no area

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
  const { areas } = useAreas()
  const [filter, setFilter] = useState<string | null>(null) // an area id, NO_AREA, or null for all
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

  // Filter by area: a task is in an area through its own areas and those of its goals. A filter for
  // an area that has since gone is treated as "all".
  const hasNone = tasks.some((t) => winAreas(t, goals).length === 0)
  const active = filter === NO_AREA ? (hasNone ? NO_AREA : null) : areas.some((a) => a.id === filter) ? filter : null
  const shown = active === null ? tasks : tasks.filter((t) => (active === NO_AREA ? winAreas(t, goals).length === 0 : winAreas(t, goals).includes(active)))

  return (
    <section className="card">
      <div className="todo-head">
        <button className="section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <h2>
            To do <span className="muted">{shown.length}</span>
          </h2>
          <span className="muted">{open ? 'Hide' : 'Show'}</span>
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
      {open && (
        <>
          {(areas.length > 0 || hasNone) && tasks.length > 0 && (
            <div className="chips" role="group" aria-label="Filter to-dos by area">
              <button className={active === null ? 'chip on neutral' : 'chip'} onClick={() => setFilter(null)}>
                All
              </button>
              {areas.map((a) => (
                <button
                  key={a.id}
                  className={active === a.id ? 'chip on' : 'chip'}
                  style={active === a.id ? chipStyle(a.colour) : undefined}
                  onClick={() => setFilter(active === a.id ? null : a.id)}
                >
                  {active === a.id ? '✓ ' : ''}
                  {a.name}
                </button>
              ))}
              {hasNone && (
                <button className={active === NO_AREA ? 'chip on neutral' : 'chip'} onClick={() => setFilter(active === NO_AREA ? null : NO_AREA)}>
                  {active === NO_AREA ? '✓ ' : ''}No area
                </button>
              )}
            </div>
          )}
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
              <li className="muted">{tasks.length === 0 ? 'Nothing waiting. Add something when it comes to mind.' : 'Nothing waiting in this area.'}</li>
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
