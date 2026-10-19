import { useState } from 'react'
import { formatMinutes, goalSource, isLinkable, startOfWeek } from '../goals'
import { MAX_NUMBER, positiveNumber } from '../limits'
import { useAreas } from '../areasContext'
import { templateHasDetails, winsNamed } from '../quickWins'
import type { Area, GoalDef, QuickWin, Win } from '../types'
import { AreaChips } from './AreaChips'

type Props = {
  quickWins: QuickWin[]
  goals: GoalDef[]
  wins: Win[] // to count the earlier wins a changed template could be applied to
  onSave: (quickWin: QuickWin) => void
  onRemove: (id: string) => void
  // Add the template's areas, goals and amount to earlier wins with the same name.
  onApplyToEarlier: (template: QuickWin, oldTitle: string, since?: Date) => void
}

// Shown after editing a template: each tap copied the old details into an ordinary win,
// so earlier wins keep them unless you choose to bring them up to date.
type Offer = { template: QuickWin; oldTitle: string; weekCount: number; allCount: number; weekStart: Date }

const goalSourceIsLinked = (g: GoalDef) => goalSource(g) === 'linked'

function QuickWinForm({
  initial,
  goals,
  onSave,
  onCancel,
}: {
  initial?: QuickWin
  goals: GoalDef[]
  onSave: (q: QuickWin) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '')
  const [minutes, setMinutes] = useState(initial?.minutes ? String(initial.minutes) : '')
  const [askMinutes, setAskMinutes] = useState(initial?.askMinutes ?? false)
  const [areas, setAreas] = useState<Area[]>(initial?.areas ?? [])
  const [goalIds, setGoalIds] = useState<string[]>(initial?.goalIds ?? [])

  // Archived goals aren't offered, but one this quick win is already linked to stays visible.
  const leafGoals = goals.filter((g) => isLinkable(g) || (!g.childIds && goalSourceIsLinked(g) && initial?.goalIds.includes(g.id)))

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (title.trim() === '') return
    const parsedAmount = positiveNumber(amount)
    const parsedMinutes = positiveNumber(minutes)
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      areas,
      goalIds,
      minutes: parsedMinutes,
      amount: parsedAmount,
      askMinutes: askMinutes || undefined,
      uses: initial?.uses ?? 0,
    })
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <input autoFocus placeholder="Name (e.g. 10 squats, Woodshop)" aria-label="Name (e.g. 10 squats, Woodshop)" value={title} onChange={(e) => setTitle(e.target.value)} />

      <input
        type="number"
        min="1"
        max={MAX_NUMBER}
        placeholder="Amount (optional, like 10)"
        aria-label="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <p className="muted">
        Tick a goal below and this adds to it each time. An amount goal adds the amounts up.
      </p>

      <div className="muted">Areas</div>
      <AreaChips value={areas} onToggle={(a) => setAreas(areas.includes(a) ? areas.filter((x) => x !== a) : [...areas, a])} />

      {leafGoals.length > 0 && (
        <fieldset className="children">
          <legend className="muted">Always counts toward (optional)</legend>
          {leafGoals.map((g) => (
            <label key={g.id}>
              <input
                type="checkbox"
                checked={goalIds.includes(g.id)}
                onChange={() => setGoalIds(goalIds.includes(g.id) ? goalIds.filter((x) => x !== g.id) : [...goalIds, g.id])}
              />
              {g.title}
            </label>
          ))}
        </fieldset>
      )}

      <input type="number" min="1" placeholder="Minutes (optional)" aria-label="Minutes (optional)" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      <label className="check-row">
        <input type="checkbox" checked={askMinutes} onChange={(e) => setAskMinutes(e.target.checked)} />
        Ask how long each time
      </label>
      <p className="muted">The ▶ on Today starts a timer instead, and logs the win with the time when you stop.</p>

      <div className="form-buttons">
        <button type="submit" className="primary" disabled={title.trim() === ''}>
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// Lives at the top of Manage > Tasks so it doesn't need a tab of its own.
export function QuickWinsSection({ quickWins, goals, wins, onSave, onRemove, onApplyToEarlier }: Props) {
  const { colourOf } = useAreas()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [offer, setOffer] = useState<Offer | null>(null)

  function save(q: QuickWin) {
    const before = quickWins.find((x) => x.id === q.id)
    onSave(q)
    setAdding(false)
    setEditingId(null)
    setOffer(null)
    // Only an EDIT can leave earlier wins out of date, and only if it gives them something.
    if (before && templateHasDetails(q)) {
      const weekStart = startOfWeek(new Date())
      const allCount = winsNamed(wins, before.title, undefined, before.id).length
      const weekCount = winsNamed(wins, before.title, weekStart, before.id).length
      if (allCount > 0) setOffer({ template: q, oldTitle: before.title, weekCount, allCount, weekStart })
    }
  }

  function applyOffer(since?: Date) {
    if (!offer) return
    // Use the template as it is NOW; if it has been removed meanwhile, there is nothing to apply.
    const current = quickWins.find((q) => q.id === offer.template.id)
    setOffer(null)
    if (current) onApplyToEarlier(current, offer.oldTitle, since)
  }

  function remove(q: QuickWin) {
    if (!window.confirm(`Remove the repeatable task "${q.title}"? Wins you already logged stay.`)) return
    setOffer(null)
    onRemove(q.id)
  }

  return (
    <section className="card">
      <button
        className="section-toggle"
        aria-expanded={open}
        onClick={() => {
          setOffer(null)
          setOpen(!open)
        }}
      >
        <h2>
          Repeatable tasks <span className="muted">{quickWins.length}</span>
        </h2>
        <span className="muted">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <>
          {offer && (
            <div className="offer" role="group" aria-label="Update earlier wins">
              <p>
                Also add this to earlier wins named “{offer.oldTitle}”?
              </p>
              <p className="muted">Adds the areas and goals (and an amount if a win has none). Nothing is removed.</p>
              <div className="form-buttons">
                {offer.weekCount > 0 && offer.weekCount < offer.allCount && (
                  <button className="primary" onClick={() => applyOffer(offer.weekStart)}>
                    This week ({offer.weekCount})
                  </button>
                )}
                <button className={offer.weekCount > 0 && offer.weekCount < offer.allCount ? '' : 'primary'} onClick={() => applyOffer()}>
                  {offer.weekCount < offer.allCount ? `All ${offer.allCount}` : `Update ${offer.allCount}`}
                </button>
                <button onClick={() => setOffer(null)}>Not now</button>
              </div>
            </div>
          )}

          <ul className="list">
            {quickWins.map((q) =>
              editingId === q.id ? (
                <li key={q.id}>
                  <div className="grow">
                    <QuickWinForm initial={q} goals={goals} onSave={save} onCancel={() => setEditingId(null)} />
                  </div>
                </li>
              ) : (
                <li key={q.id}>
                  <span className="dot" style={{ background: colourOf(q.areas[0]) }} />
                  <div className="grow">
                    <div>{q.title}</div>
                    <div className="muted">
                      {[
                        q.amount ? String(q.amount) : null,
                        q.minutes ? formatMinutes(q.minutes) : null,
                        q.askMinutes ? 'asks how long' : null,
                        q.uses > 0 ? `used ${q.uses}×` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Plain win'}
                    </div>
                  </div>
                  <button
                    className="link"
                    onClick={() => {
                      setOffer(null)
                      setEditingId(q.id)
                    }}
                  >
                    Edit
                  </button>
                  <button className="link" onClick={() => remove(q)}>
                    Remove
                  </button>
                </li>
              ),
            )}
            {quickWins.length === 0 && <li className="muted">None yet. Add the things you do again and again.</li>}
          </ul>

          {adding ? (
            <QuickWinForm goals={goals} onSave={save} onCancel={() => setAdding(false)} />
          ) : (
            <button className="link" onClick={() => setAdding(true)}>
              + Add a repeatable task
            </button>
          )}
        </>
      )}
    </section>
  )
}
