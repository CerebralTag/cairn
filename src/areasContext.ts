import { createContext, useContext } from 'react'
import { colourFor, nameFor } from './areas'
import type { Area, AreaDef, GoalDef } from './types'

// Areas are needed by many small components (chips, dots, charts). A context
// makes them available anywhere below <AreasContext.Provider> without passing
// them through every level, a bit like injecting a service in C#.
export const AreasContext = createContext<AreaDef[]>([])

export function useAreas() {
  const areas = useContext(AreasContext)
  return {
    areas,
    colourOf: (id: Area | undefined) => colourFor(areas, id),
    nameOf: (id: Area) => nameFor(areas, id),
    // A goal takes the colour of its first area; with no area it uses the accent.
    goalColour: (goal: GoalDef) => (goal.areas[0] ? colourFor(areas, goal.areas[0]) : 'var(--color-accent)'),
  }
}
