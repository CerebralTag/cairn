import { useEffect, useRef } from 'react'
import { useAreas } from '../areasContext'
import type { TimeEntryPatch, WinValues } from '../edits'
import { formatMinutes } from '../goals'
import type { ActivityItem } from '../reports'
import type { GoalDef, TimeEntry, Win } from '../types'
import { TimeEntryForm } from './TimeEntryForm'
import { WinForm } from './WinForm'

// What the list needs to let you fix an entry right where you see it (Today only; the
// day detail in History stays read-only and links to the full log instead).
export type TodayEditor = {
  wins: Win[]
  timeEntries: TimeEntry[]
  goals: GoalDef[]
  editingKey: string | null
  setEditingKey: (key: string | null) => void
  onEditWin: (id: string, values: WinValues) => void
  onDeleteWin: (id: string) => void
  onUpdateEntry: (id: string, patch: TimeEntryPatch) => void
  onDeleteEntry: (id: string) => void
}

type Props = {
  items: ActivityItem[]
  title?: string
  emptyText?: string
  showDay?: boolean // a week's list shows the day with each time
  editor?: TodayEditor
}

// "Progress · 10 · 20m": what it was beyond its title, plain and without units.
function detail(item: ActivityItem): string {
  return [
    item.kind === 'progress' ? 'Progress' : null,
    item.amount !== undefined ? String(item.amount) : null,
    item.minutes > 0 ? formatMinutes(item.minutes) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function TodayWins({
  items,
  title = "Today's wins",
  emptyText = 'Nothing logged yet. Whatever you do next counts.',
  showDay = false,
  editor,
}: Props) {
  const { colourOf } = useAreas()
  const formRef = useRef<HTMLLIElement>(null)
  const editingKey = editor?.editingKey ?? null

  // Opening the editor from a bead can be far down the page: bring it into view.
  useEffect(() => {
    if (editingKey) formRef.current?.scrollIntoView({ block: 'center' })
  }, [editingKey])

  function form(item: ActivityItem) {
    if (!editor) return null
    const close = () => editor.setEditingKey(null)

    if (item.kind === 'win') {
      const win = editor.wins.find((w) => w.id === item.key)
      if (!win) return null
      return (
        <WinForm
          goals={editor.goals}
          initial={{ title: win.title, areas: win.areas, goalIds: win.goalIds, at: win.completedAt, amount: win.amount }}
          withWhen
          onSave={(values) => {
            editor.onEditWin(win.id, values)
            close()
          }}
          onCancel={close}
          onDelete={() => {
            if (!window.confirm(`Delete "${win.title}"? Time logged on it is kept.`)) return
            editor.onDeleteWin(win.id)
            close()
          }}
        />
      )
    }

    // A progress line is time on a task that is not finished yet: Edit opens the task itself, as in
    // the to-do list (so its title, areas and goals can be fixed here; its sessions stay as they are).
    if (item.kind === 'progress') {
      const task = editor.wins.find((w) => w.id === item.taskId)
      if (!task) return null
      return (
        <WinForm
          goals={editor.goals}
          initial={task}
          onSave={(values) => {
            editor.onEditWin(task.id, values)
            close()
          }}
          onCancel={close}
        />
      )
    }

    const entry = editor.timeEntries.find((e) => e.id === item.key)
    if (!entry) return null
    return (
      <TimeEntryForm
        entry={entry}
        goals={editor.goals}
        onSave={(patch) => {
          editor.onUpdateEntry(entry.id, patch)
          close()
        }}
        onCancel={close}
        onDelete={() => {
          if (!window.confirm(`Delete ${formatMinutes(entry.minutes)} of "${item.title}"?`)) return
          editor.onDeleteEntry(entry.id)
          close()
        }}
      />
    )
  }

  const editable = editor !== undefined

  return (
    <section className="card">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <ul className="list">
          {items.map((item) =>
            editingKey === item.key && editable ? (
              <li key={item.key} ref={formRef}>
                <div className="grow">{form(item)}</div>
              </li>
            ) : (
              <li key={item.key}>
                <span className="dot" style={{ background: colourOf(item.areas[0]) }} />
                <div className="grow">
                  <div>{item.title}</div>
                  {detail(item) && <div className="muted">{detail(item)}</div>}
                </div>
                <span className="muted">
                  {item.at.toLocaleString([], showDay ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { hour: 'numeric', minute: '2-digit' })}
                </span>
                {editable && (
                  <button className="link" aria-label={`Edit ${item.title}`} onClick={() => editor?.setEditingKey(item.key)}>
                    Edit
                  </button>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}
