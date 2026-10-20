import { useState } from 'react'
import { PALETTE_SIZE, paletteColour } from '../areas'
import { fileableGoals } from '../areaGoals'
import type { AreaDef, GoalDef } from '../types'

type Props = {
  areas: AreaDef[]
  goals: GoalDef[]
  onSave: (area: AreaDef, goalIds?: string[]) => void
  onRemove: (id: string) => void
}

type FormProps = {
  initial?: AreaDef
  areas: AreaDef[]
  goals: GoalDef[]
  onSave: (a: AreaDef, goalIds: string[]) => void
  onCancel: () => void
}

function AreaForm({ initial, areas, goals, onSave, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  // New areas start on the first palette colour nobody is using yet.
  const [colour, setColour] = useState(
    initial?.colour ?? Array.from({ length: PALETTE_SIZE }, (_, i) => i + 1).find((c) => !areas.some((a) => a.colour === c)) ?? 1,
  )

  const choices = fileableGoals(goals)
  const [goalIds, setGoalIds] = useState<string[]>(initial ? choices.filter((g) => g.areas.includes(initial.id)).map((g) => g.id) : [])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (name.trim() === '') return
    onSave({ ...initial, id: initial?.id ?? crypto.randomUUID(), name: name.trim(), colour }, goalIds)
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <input autoFocus placeholder="Area name" aria-label="Area name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="swatches">
        {Array.from({ length: PALETTE_SIZE }, (_, i) => i + 1).map((slot) => (
          <button
            key={slot}
            type="button"
            aria-label={`Colour ${slot}`}
            aria-pressed={colour === slot}
            className={colour === slot ? 'swatch on' : 'swatch'}
            style={{ background: paletteColour(slot) }}
            onClick={() => setColour(slot)}
          />
        ))}
      </div>
      {choices.length > 0 && (
        <fieldset className="children">
          <legend className="muted">Goals in this area</legend>
          {choices.map((g) => (
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
      <div className="form-buttons">
        <button type="submit" className="primary" disabled={name.trim() === ''}>
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function AreasPanel({ areas, goals, onSave, onRemove }: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  function save(area: AreaDef, goalIds: string[]) {
    onSave(area, goalIds)
    setAdding(false)
    setEditingId(null)
  }

  function remove(area: AreaDef) {
    if (!window.confirm(`Remove "${area.name}"? Your entries and goals stay; they just lose this label.`)) return
    onRemove(area.id)
  }

  return (
    <>
      <section className="card">
        <p className="muted">Each area with goals gets a ring on Today. Switch one off to hide it and its goals there.</p>
        <ul className="list">
          {areas.map((area) =>
            editingId === area.id ? (
              <li key={area.id}>
                <div className="grow">
                  <AreaForm initial={area} areas={areas} goals={goals} onSave={save} onCancel={() => setEditingId(null)} />
                </div>
              </li>
            ) : (
              <li key={area.id}>
                <span className="dot" style={{ background: paletteColour(area.colour) }} />
                <div className="grow">{area.name}</div>
                <label className="check-row" title="Give this area a ring on Today">
                  <input
                    type="checkbox"
                    checked={area.onToday !== false}
                    onChange={(e) => onSave({ ...area, onToday: e.target.checked ? undefined : false })}
                  />
                  On Today
                </label>
                <button className="link" onClick={() => setEditingId(area.id)}>
                  Edit
                </button>
                <button className="link" onClick={() => remove(area)}>
                  Remove
                </button>
              </li>
            ),
          )}
          {areas.length === 0 && <li className="muted">No areas yet.</li>}
        </ul>
      </section>

      {adding ? (
        <AreaForm areas={areas} goals={goals} onSave={save} onCancel={() => setAdding(false)} />
      ) : areas.length < PALETTE_SIZE ? (
        <button className="did-something" onClick={() => setAdding(true)}>
          Add an area
        </button>
      ) : (
        <p className="muted">That's all {PALETTE_SIZE} area colours. Remove one to add another.</p>
      )}
    </>
  )
}
