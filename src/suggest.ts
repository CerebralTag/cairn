// Name suggestions for the entry dialogs. As you type a title, names you've used before
// appear; picking one fills in what you chose last time (areas, goals, amount). A name
// that matches a goal's own name also ticks that goal. There is no unit or measure to
// define: the name is the link.
import { isActive } from './goals'
import type { AppData, Area } from './types'

export type Suggestion = {
  title: string
  areas: Area[]
  goalIds: string[]
  amount?: number
}

type Pooled = Suggestion & { uses: number; last: number }

// Two names are the same name when they match ignoring case, accents, spacing and
// punctuation: "Push-ups", "push ups" and "Pushups!" are one. This is only ever used to
// COMPARE; the title is stored and shown exactly as it was typed, so nothing is lost.
// (A title with no letters or digits at all, like an emoji, keeps its own text as its key.)
//
// Only spaces and ordinary punctuation are ignored. Letters, digits, symbols and emoji are
// kept, along with # & @ % *, because they change what a name means: C++, C# and C are
// three different things, and "🎸 practice" is not "practice".
const IGNORED = /[^\p{L}\p{N}\p{S}#&@%*]/gu

export function nameKey(name: string): string {
  const key = stripMarks(name).replace(IGNORED, '')
  return key !== '' ? key : name.trim().toLowerCase()
}

// The same but with word breaks kept, for ranking: "Wall push-ups" -> "wall push ups".
function wordsOf(name: string): string {
  return stripMarks(name).replace(/[^\p{L}\p{N}\p{S}#&@%*]+/gu, ' ').trim()
}

// Drop Latin-style accents ("Café" -> "cafe") but leave other scripts alone: the voicing
// marks that make ピ different from ヒ are not accents. NFC puts those back together.
function stripMarks(name: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase()
}

const unique = <T>(items: T[]) => [...new Set(items)]

// Every name worth suggesting, one entry per name (case and spacing ignored), carrying
// the details from its most recent use. Built once per change of data, then queried.
export function buildSuggestionPool(data: AppData): Pooled[] {
  const activeGoalIds = new Set(data.goals.filter((g) => !g.childIds && isActive(g)).map((g) => g.id))
  const areaIds = new Set(data.areas.map((a) => a.id))
  const pool = new Map<string, Pooled>()

  const add = (title: string, areas: Area[], goalIds: string[], amount: number | undefined, at: number) => {
    const key = nameKey(title)
    if (title.trim() === '') return
    const entry: Pooled = {
      title: title.trim(),
      areas: areas.filter((a) => areaIds.has(a)),
      goalIds: goalIds.filter((g) => activeGoalIds.has(g)),
      amount,
      uses: 1,
      last: at,
    }
    const existing = pool.get(key)
    if (!existing) pool.set(key, entry)
    else {
      existing.uses += 1
      // The most recent use supplies the details and the spelling.
      if (at >= existing.last) pool.set(key, { ...entry, uses: existing.uses })
    }
  }

  for (const w of data.wins) add(w.title, w.areas, w.goalIds, w.amount, (w.completedAt ?? w.createdAt).getTime())
  for (const e of data.timeEntries) if (e.title) add(e.title, e.areas, e.goalIds, undefined, e.at.getTime())
  // Quick wins are deliberate setups, so they are always offered (as a name used once).
  for (const q of data.quickWins) add(q.title, q.areas, q.goalIds, q.amount, 0)

  // Matching by name: a name equal to an active goal's name ticks that goal and takes its areas.
  for (const g of data.goals) {
    if (g.childIds || !isActive(g)) continue
    const key = nameKey(g.title)
    const existing = pool.get(key)
    if (existing) {
      existing.goalIds = unique([...existing.goalIds, g.id])
      if (existing.areas.length === 0) existing.areas = g.areas.filter((a) => areaIds.has(a))
    } else {
      pool.set(key, { title: g.title, areas: g.areas.filter((a) => areaIds.has(a)), goalIds: [g.id], uses: 0, last: 0 })
    }
  }
  return [...pool.values()]
}

// The best few names for what has been typed so far. Names starting with it come first,
// then names with a word starting with it, then names containing it; ties go to the
// most used, then the most recent.
export function matchSuggestions(pool: Pooled[], query: string, limit = 5): Suggestion[] {
  if (query.trim() === '') return []
  const q = wordsOf(query)
  const qKey = nameKey(query)
  const scored: { item: Pooled; score: number }[] = []
  for (const item of pool) {
    const t = wordsOf(item.title)
    const tKey = nameKey(item.title)
    // Punctuation and spacing don't matter: "pushup" finds "Push-ups", "push-u" finds "Pushups".
    const score = t.startsWith(q) || tKey.startsWith(qKey) ? 0 : ` ${t}`.includes(` ${q}`) ? 1 : tKey.includes(qKey) ? 2 : -1
    if (score >= 0) scored.push({ item, score })
  }
  scored.sort((a, b) => a.score - b.score || b.item.uses - a.item.uses || b.item.last - a.item.last || a.item.title.localeCompare(b.item.title))
  return scored.slice(0, limit).map(({ item }) => ({ title: item.title, areas: item.areas, goalIds: item.goalIds, amount: item.amount }))
}

export function makeSuggest(data: AppData): (query: string) => Suggestion[] {
  const pool = buildSuggestionPool(data)
  return (query) => matchSuggestions(pool, query)
}
