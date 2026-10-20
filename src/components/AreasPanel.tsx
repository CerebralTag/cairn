import { useState } from 'react'
import { PALETTE_SIZE, paletteColour } from '../areas'
import type { AreaDef } from '../types'

type Props = {
  areas: AreaDef[]
  onSave: (area: AreaDef) => void
  onRemove: (id: string) => void
}

function AreaForm({ initial, areas, onSave, onCancel }: { initial?: AreaDef; areas: AreaDef[]; onSave: (a: AreaDef) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  // New areas start on the first palette colour nobody is using yet.
  const [colour, setColour] = useState(
    initial?.colour ?? Array.from({ length: PALETTE_SIZE }, (_, i) => i + 1).find((c) => !areas.some((a) => a.colour === c)) ?? 1,
  )

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (name.trim() === '') return
    onSave({ ...initial, id: initial?.id ?? crypto.randomUUID(), name: name.trim(), colour })
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

export function AreasPanel({ areas, onSave, onRemove }: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  function save(area: AreaDef) {
    onSave(area)
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
                  <AreaForm initial={area} areas={areas} onSave={save} onCancel={() => setEditingId(null)} />
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
        <AreaForm areas={areas} onSave={save} onCancel={() => setAdding(false)} />
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
