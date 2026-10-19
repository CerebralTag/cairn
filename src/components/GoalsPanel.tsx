import { useState } from 'react'
import { useAreas } from '../areasContext'
import { PERIOD_WORDS, currentTarget, formatMinutes, isActive } from '../goals'
import type { GoalDef } from '../types'
import { GoalForm } from './GoalForm'

type Props = {
  goals: GoalDef[]
  onSave: (goal: GoalDef, backfill: boolean) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

function describe(goal: GoalDef, goals: GoalDef[]): string {
  const per = PERIOD_WORDS[goal.period].per
  if (goal.childIds) {
    const n = goal.childIds.filter((id) => goals.some((g) => g.id === id && isActive(g))).length
    return n === 0 ? 'No goals included yet. Edit it to choose some.' : `Met when all ${n} of its goals are met, ${per}`
  }
  const target = currentTarget(goal, new Date())
  if (goal.kind === 'time') return `${formatMinutes(target)} ${per}`
  return `${target} ${per}`
}

export function GoalsPanel({ goals, onSave, onArchive, onRestore, onDelete }: Props) {
  const { goalColour } = useAreas()
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
                  <div className="muted">{describe(goal, goals)}</div>
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
        <button className="did-something" onClick={() => setAdding(true)}>
          Add a goal
        </button>
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
                      <div className="muted">{describe(goal, goals)}</div>
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
