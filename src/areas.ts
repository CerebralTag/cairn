import type { Area, AreaDef } from './types'

export const PALETTE_SIZE = 7

// Starter areas. The ids match the ones used before areas became editable data.
export const DEFAULT_AREAS: AreaDef[] = [
  { id: 'music', name: 'Music', colour: 1 },
  { id: 'health', name: 'Health', colour: 2 },
  { id: 'work', name: 'Work', colour: 3 },
  { id: 'learning', name: 'Learning', colour: 4 },
  { id: 'home', name: 'Home', colour: 5 },
]

export const NEUTRAL_COLOUR = 'var(--color-bead-neutral)' // an entry with no area: the same grey everywhere

export function paletteColour(slot: number): string {
  return `var(--palette-${slot})`
}

// A selected chip: a light tint of the area's colour, a border in the colour itself,
// and normal dark text. (White text on the palette colours misses contrast targets
// for several of them.) The ✓ added by the chip means selection never relies on colour alone.
export function chipStyle(slot: number): { background: string; borderColor: string; boxShadow: string } {
  const colour = paletteColour(slot)
  return {
    background: `color-mix(in srgb, ${colour} 18%, var(--color-surface))`,
    borderColor: colour,
    boxShadow: `0 0 0 1px ${colour}`,
  }
}

export function colourFor(areas: AreaDef[], id: Area | undefined): string {
  const area = areas.find((a) => a.id === id)
  return area ? paletteColour(area.colour) : NEUTRAL_COLOUR
}

export function nameFor(areas: AreaDef[], id: Area): string {
  return areas.find((a) => a.id === id)?.name ?? id
}
