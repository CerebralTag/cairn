import { chipStyle } from '../areas'
import { useAreas } from '../areasContext'
import type { Area } from '../types'

// Toggle chips for picking any number of areas.
export function AreaChips({ value, onToggle }: { value: Area[]; onToggle: (area: Area) => void }) {
  const { areas } = useAreas()

  if (areas.length === 0) return <p className="muted">No areas yet. Add some under Manage.</p>

  return (
    <div className="chips">
      {areas.map((area) => {
        const on = value.includes(area.id)
        return (
          <button
            key={area.id}
            type="button"
            aria-pressed={on}
            className={on ? 'chip on' : 'chip'}
            style={on ? chipStyle(area.colour) : undefined}
            onClick={() => onToggle(area.id)}
          >
            {on ? '✓ ' : ''}
            {area.name}
          </button>
        )
      })}
    </div>
  )
}
