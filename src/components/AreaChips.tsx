import { chipStyle } from '../areas'
import { useAreas } from '../areasContext'
import type { Area } from '../types'

type Props = { value: Area[]; onToggle: (area: Area) => void; label?: string }

// Toggle chips for picking any number of areas.
export function AreaChips({ value, onToggle, label = 'Areas' }: Props) {
  const { areas } = useAreas()

  // Areas are optional: with none set up, forms simply don't mention them.
  if (areas.length === 0) return null

  return (
    <>
      <div className="muted">{label}</div>
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
    </>
  )
}
