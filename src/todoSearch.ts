import type { Win } from './types'

// Lower case without accents, so "cafe" finds "Café".
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

// Search the to-do list by title: every word typed must appear somewhere in the title, in any order
// ("tax call" finds "Call about tax"). An empty search matches everything.
export function matchesSearch(task: Win, query: string): boolean {
  const title = fold(task.title)
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => title.includes(word))
}
