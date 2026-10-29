import { useState } from 'react'
import { NEUTRAL_COLOUR, PALETTE_SIZE, paletteColour } from '../areas'
import { fileableGoals } from '../areaGoals'
import { canMoveArea, type Direction } from '../order'
import type { AppData, AreaDef, GoalDef } from '../types'

type Props = {
  areas: AreaDef[]
  goals: GoalDef[]
  otherOnToday: boolean
  onMove: (id: string, dir: Direction) => void // reorder the rings
  onOtherOnToday: (on: boolean) => void
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

export function AreasPanel({ areas, goals, otherOnToday, onMove, onOtherOnToday, onSave, onRemove }: Props) {
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
        <p className="muted">Each area gets a ring on Today, in this order (use the arrows to rearrange). Switch one off to hide its ring.</p>
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
                <span className="move" role="group" aria-label={`Move ${area.name}`}>
                  <button className="link" aria-label={`Move ${area.name} up`} disabled={!canMoveArea({ areas } as AppData, area.id, -1)} onClick={() => onMove(area.id, -1)}>
                    ↑
                  </button>
                  <button className="link" aria-label={`Move ${area.name} down`} disabled={!canMoveArea({ areas } as AppData, area.id, 1)} onClick={() => onMove(area.id, 1)}>
                    ↓
                  </button>
                </span>
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
          {/* Always here, and can't be removed: the ring for goals that have no area. */}
          <li>
            <span className="dot" style={{ background: NEUTRAL_COLOUR }} />
            <div className="grow">
              Other <span className="muted">goals with no area</span>
            </div>
            <label className="check-row" title="Give goals with no area a ring on Today">
              <input type="checkbox" checked={otherOnToday} onChange={(e) => onOtherOnToday(e.target.checked)} />
              On Today
            </label>
          </li>
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
