import { useState } from 'react'
import { chipStyle } from '../areas'
import { useAreas } from '../areasContext'
import { winAreas } from '../goals'
import { positiveNumber } from '../limits'
import { soFarLabel } from '../reports'
import type { Area, GoalDef, QuickWin, TimeEntry, Win, WinStatus } from '../types'
import { QuickWinsSection } from './QuickWinsSection'
import { WinForm, type WinValues } from './WinForm'

type Props = {
  wins: Win[]
  goals: GoalDef[]
  timeEntries: TimeEntry[]
  quickWins: QuickWin[]
  addRepeatable?: boolean // open the repeatable-task section with its add form
  onSaveQuickWin: (quickWin: QuickWin) => void
  onApplyTemplateToEarlier: (template: QuickWin, oldTitle: string, since?: Date) => void
  onRemoveQuickWin: (id: string) => void
  onAdd: (values: WinValues) => void
  onEdit: (id: string, values: WinValues) => void
  onSetStatus: (id: string, status: WinStatus) => void
  onDelete: (id: string) => void
  onAddSession: (id: string, minutes: number) => void
  timerRunning: boolean
  onStartTimer: (task: Win) => void
}

const DONE_PAGE = 15

export function TasksPanel({
  wins,
  goals,
  timeEntries,
  quickWins,
  addRepeatable,
  onSaveQuickWin,
  onApplyTemplateToEarlier,
  onRemoveQuickWin,
  onAdd,
  onEdit,
  onSetStatus,
  onDelete,
  onAddSession,
  timerRunning,
  onStartTimer,
}: Props) {
  const { areas, colourOf } = useAreas()
  const [filter, setFilter] = useState<Area | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null) // which row's actions are open
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState('')
  const [showAllDone, setShowAllDone] = useState(false)
  const [showDropped, setShowDropped] = useState(false)

  const visible = wins.filter((w) => filter === null || winAreas(w, goals).includes(filter))
  const byStatus = (s: WinStatus) => visible.filter((w) => w.status === s)
  const todo = byStatus('todo')
  const doing = byStatus('doing')
  const done = byStatus('done').sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
  const dropped = byStatus('dropped')

  function submitSession(event: React.FormEvent) {
    event.preventDefault()
    const parsed = positiveNumber(minutes)
    if (sessionId && parsed !== undefined) onAddSession(sessionId, parsed)
    setSessionId(null)
    setMinutes('')
  }

  function remove(task: Win) {
    if (!window.confirm(`Delete "${task.title}"? Time logged on it is kept.`)) return
    onDelete(task.id)
  }

  function row(task: Win) {
    if (editingId === task.id) {
      return (
        <li key={task.id}>
          <div className="grow">
            <WinForm
              goals={goals}
              initial={{ title: task.title, areas: task.areas, goalIds: task.goalIds, at: task.completedAt, amount: task.amount }}
              // A finished win can be re-timed; the amount is offered for every task and win.
              withWhen={task.status === 'done'}
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

    const open = menuId === task.id
    const soFar = soFarLabel(task.id, timeEntries)
    const act = (fn: () => void) => () => {
      fn()
      setMenuId(null)
    }

    return (
      <li key={task.id} className={task.status === 'done' || task.status === 'dropped' ? 'done' : ''}>
        {task.status !== 'dropped' && (
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={() => {
              // Reopening takes a win out of your history until it is finished again, so
              // a stray tap shouldn't do it silently.
              if (task.status === 'done' && !window.confirm(`Reopen "${task.title}"? It leaves your wins until you finish it again.`)) return
              onSetStatus(task.id, task.status === 'done' ? 'todo' : 'done')
            }}
            aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Finish ${task.title}`}
          />
        )}
        <div className="grow">
          <div>{task.title}</div>
          {(soFar || task.amount !== undefined || winAreas(task, goals).length > 0) && (
            <div className="muted task-meta">
              {winAreas(task, goals).map((a) => (
                <span key={a} className="dot small" style={{ background: colourOf(a) }} />
              ))}
              {[task.amount !== undefined ? String(task.amount) : null, soFar].filter(Boolean).join(' · ')}
            </div>
          )}
          {sessionId === task.id && (
            <form className="session-form" onSubmit={submitSession}>
              <input autoFocus type="number" min="1" placeholder="Minutes worked" aria-label="Minutes worked" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              <button type="submit" className="link">
                Add
              </button>
            </form>
          )}
          {open && (
            <div className="actions">
              <button className="link" onClick={act(() => setEditingId(task.id))}>Edit</button>
              {(task.status === 'todo' || task.status === 'doing') && !timerRunning && (
                <button className="link" onClick={act(() => onStartTimer(task))}>▶ Timer</button>
              )}
              {(task.status === 'todo' || task.status === 'doing') && (
                <button className="link" onClick={act(() => setSessionId(task.id))}>+ Time</button>
              )}
              {task.status === 'todo' && <button className="link" onClick={act(() => onSetStatus(task.id, 'doing'))}>Start</button>}
              {task.status === 'doing' && <button className="link" onClick={act(() => onSetStatus(task.id, 'todo'))}>Pause</button>}
              {(task.status === 'todo' || task.status === 'doing') && (
                <button className="link" onClick={act(() => onSetStatus(task.id, 'dropped'))}>Drop</button>
              )}
              {task.status === 'dropped' && <button className="link" onClick={act(() => onSetStatus(task.id, 'todo'))}>Reopen</button>}
              <button className="link" onClick={act(() => remove(task))}>Delete</button>
            </div>
          )}
        </div>
        <button className="link" aria-label="More actions" aria-expanded={open} onClick={() => setMenuId(open ? null : task.id)}>
          ⋯
        </button>
      </li>
    )
  }

  const section = (title: string, items: Win[], extra?: React.ReactNode) =>
    items.length > 0 && (
      <section className="card">
        <h2>
          {title} <span className="muted">{items.length}</span>
        </h2>
        <ul className="list">{items.map(row)}</ul>
        {extra}
      </section>
    )

  return (
    <>
      <QuickWinsSection
        startAdding={addRepeatable}
        quickWins={quickWins}
        goals={goals}
        wins={wins}
        onSave={onSaveQuickWin}
        onRemove={onRemoveQuickWin}
        onApplyToEarlier={onApplyTemplateToEarlier}
      />

      {areas.length > 1 && (
        <div className="chips" role="group" aria-label="Filter by area">
          <button className={filter === null ? 'chip on neutral' : 'chip'} onClick={() => setFilter(null)}>
            All
          </button>
          {areas.map((a) => (
            <button
              key={a.id}
              className={filter === a.id ? 'chip on' : 'chip'}
              style={filter === a.id ? chipStyle(a.colour) : undefined}
              onClick={() => setFilter(filter === a.id ? null : a.id)}
            >
              {filter === a.id ? '✓ ' : ''}
              {a.name}
            </button>
          ))}
        </div>
      )}

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
        <button className="did-something" onClick={() => setAdding(true)}>
          Add a task
        </button>
      )}

      {section('Doing', doing)}
      {section('To do', todo)}
      {section(
        'Done',
        showAllDone ? done : done.slice(0, DONE_PAGE),
        done.length > DONE_PAGE && !showAllDone ? (
          <button className="link" onClick={() => setShowAllDone(true)}>
            Show all {done.length}
          </button>
        ) : undefined,
      )}
      {dropped.length > 0 &&
        (showDropped ? (
          section('Dropped', dropped)
        ) : (
          <button className="link" onClick={() => setShowDropped(true)}>
            Show dropped ({dropped.length})
          </button>
        ))}
      {todo.length + doing.length + done.length + dropped.length === 0 && (
        <p className="muted">Nothing here yet.</p>
      )}
    </>
  )
}
