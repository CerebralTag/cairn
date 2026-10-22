import { useState } from 'react'
import { useAreas } from '../areasContext'
import { PERIOD_WORDS, currentTarget, formatMinutes, goalSource, isActive, withTarget } from '../goals'
import type { GoalDef } from '../types'
import { GoalForm } from './GoalForm'

type Props = {
  goals: GoalDef[]
  onSave: (goal: GoalDef, backfill: boolean) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

function describe(goal: GoalDef, goals: GoalDef[], areaNames: string[]): string {
  const where = areaNames.length > 0 ? ` · ${areaNames.join(', ')}` : ''
  const per = PERIOD_WORDS[goal.period].per
  if (goal.childIds) {
    const n = goal.childIds.filter((id) => goals.some((g) => g.id === id && isActive(g))).length
    return n === 0 ? 'No goals included yet. Edit it to choose some.' : `Met when all ${n} of its goals are met, ${per}${where}`
  }
  if (goalSource(goal) === 'each') return goal.tracked === false ? 'Routine · a container for its repeatable tasks' : `Routine · its repeatable tasks, ${per}${where}`
  const target = currentTarget(goal, new Date())
  const rule = RULE_WORDS[goalSource(goal)]?.[goal.kind === 'time' ? 'time' : 'count']
  const amount = goal.kind === 'time' ? formatMinutes(target) : String(target)
  return `${amount} ${per}${rule ? `, ${rule}` : ''}${where}`
}

// How a goal's rule reads in the list. 'linked' is the plain default and needs no words.
const RULE_WORDS: Record<string, { time?: string; count?: string }> = {
  any: { time: 'all the time you log', count: 'anything you finish' },
  todo: { count: 'to-dos you finish' },
  quick: { count: 'repeatable tasks you tap' },
}

// One-tap starters: ordinary goals, ready to edit. Nothing special is stored for them.
const STARTERS: { label: string; title: string; kind: 'count' | 'time'; source: 'any' | 'todo'; amount: number }[] = [
  { label: 'Do 10 things', title: 'Do 10 things', kind: 'count', source: 'any', amount: 10 },
  { label: 'Finish 10 to-dos', title: 'Finish 10 to-dos', kind: 'count', source: 'todo', amount: 10 },
  { label: '10 hours of anything', title: '10 hours of anything', kind: 'time', source: 'any', amount: 600 },
]

export function GoalsPanel({ goals, onSave, onArchive, onRestore, onDelete }: Props) {
  const { goalColour, nameOf } = useAreas()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const active = goals.filter(isActive)
  const archived = goals.filter((g) => !isActive(g))

  function save(goal: GoalDef, backfill: boolean) {
    onSave(goal, backfill)
    setAdding(false)
    setEditingId(null)
  }

  function addStarter(starter: (typeof STARTERS)[number]) {
    const now = new Date()
    const goal: GoalDef = {
      id: crypto.randomUUID(),
      title: starter.title,
      areas: [],
      kind: starter.kind,
      period: 'week',
      source: starter.source,
      targets: [],
    }
    onSave(withTarget(goal, starter.amount, now), false)
  }

  function deleteForGood(goal: GoalDef) {
    if (!window.confirm(`Delete "${goal.title}" for good? Its past results will be gone. Your wins and time stay.`)) return
    onDelete(goal.id)
  }

  return (
    <>
      <section className="card">
        <ul className="list">
          {active.map((goal) =>
            editingId === goal.id ? (
              <li key={goal.id}>
                <div className="grow">
                  <GoalForm initial={goal} allGoals={goals} onSave={save} onCancel={() => setEditingId(null)} />
                </div>
              </li>
            ) : (
              <li key={goal.id}>
                <span className="dot" style={{ background: goalColour(goal) }} />
                <div className="grow">
                  <div>{goal.title}</div>
                  <div className="muted">{describe(goal, goals, goal.areas.map(nameOf))}</div>
                </div>
                <button className="link" onClick={() => setEditingId(goal.id)}>
                  Edit
                </button>
                <button className="link" onClick={() => onArchive(goal.id)}>
                  Archive
                </button>
              </li>
            ),
          )}
          {active.length === 0 && <li className="muted">No goals yet. Add one to see progress rings on Today.</li>}
        </ul>
      </section>

      {adding ? (
        <GoalForm allGoals={goals} onSave={save} onCancel={() => setAdding(false)} />
      ) : (
        <>
          <button className="did-something" onClick={() => setAdding(true)}>
            Add a goal
          </button>
          <div className="chips" aria-label="Quick starts">
            {/* A starter you already added isn't offered again (it would just make a twin). */}
            {STARTERS.filter((s) => !active.some((g) => g.title === s.title)).map((s) => (
              <button key={s.label} className="chip" onClick={() => addStarter(s)}>
                + {s.label}
              </button>
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <section className="card">
          <button className="section-toggle" aria-expanded={showArchived} onClick={() => setShowArchived(!showArchived)}>
            <h2>
              Archived <span className="muted">{archived.length}</span>
            </h2>
            <span className="muted">{showArchived ? 'Hide' : 'Show'}</span>
          </button>
          {showArchived && (
            <>
              <p className="muted">Archived goals keep their history. They just stop showing on Today.</p>
              <ul className="list">
                {archived.map((goal) => (
                  <li key={goal.id}>
                    <span className="dot" style={{ background: goalColour(goal) }} />
                    <div className="grow">
                      <div>{goal.title}</div>
                      <div className="muted">{describe(goal, goals, goal.areas.map(nameOf))}</div>
                    </div>
                    <button className="link" onClick={() => onRestore(goal.id)}>
                      Restore
                    </button>
                    <button className="link" onClick={() => deleteForGood(goal)}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  )
}
