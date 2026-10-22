// Turning AppData into text and back. Used both for localStorage and for backup
// files, so the two can never drift apart.
//
// `deserialize` is the gatekeeper: nothing reaches the app unless every record in
// it has exactly the shape the rest of the code assumes. A file that looks right
// from the outside but is damaged inside is rejected as a whole, because loading it
// would otherwise crash the app on every launch.
import { DEFAULT_AREAS, PALETTE_SIZE } from './areas'
import { parseDateInput, toDateInput } from './dates'
import type { ActiveTimer, AppData, AreaDef, GoalDef, GoalPeriod, QuickWin, TimeEntry, Win } from './types'

export const DATA_VERSION = 2

// JSON has no Date type: JSON.stringify writes a Date as an ISO-8601 string, so
// on the way back in we turn those strings into Dates again.
type StoredTarget = { from: string; amount: number }
type StoredGoal = Omit<GoalDef, 'targets' | 'period' | 'archivedAt'> & {
  targets: StoredTarget[]
  period?: GoalPeriod // absent in older saves: those goals were all weekly
  archivedAt?: string
}
type StoredWin = Omit<Win, 'createdAt' | 'completedAt'> & { createdAt: string; completedAt?: string }
type StoredEntry = Omit<TimeEntry, 'at'> & { at: string }
type Stored = {
  version: number
  areas?: AreaDef[]
  quickWins?: QuickWin[]
  timer?: (Omit<ActiveTimer, 'startedAt'> & { startedAt: string }) | null
  otherOnToday?: boolean
  goals: StoredGoal[]
  wins: StoredWin[]
  timeEntries: StoredEntry[]
}

// A goal target's start is a calendar day ("the week of 12 Oct"), not an instant,
// so it is saved as YYYY-MM-DD and read back as local midnight. Saved as an instant
// it would shift by a day (or hide the target) when the phone changes time zone.
// Older saves hold full ISO instants, which are still read as before.
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function reviveGoal<T extends { targets: StoredTarget[] }>(g: T) {
  return {
    ...g,
    targets: g.targets.map((t) => ({
      from: DAY_ONLY.test(t.from) ? parseDateInput(t.from) : new Date(t.from),
      amount: t.amount,
    })),
  }
}

export function serialize(data: AppData, extra: Record<string, unknown> = {}): string {
  const goals = data.goals.map((g) => ({
    ...g,
    targets: g.targets.map((t) => ({ from: toDateInput(t.from), amount: t.amount })),
  }))
  return JSON.stringify({ version: DATA_VERSION, ...extra, ...data, goals })
}

// The text for saving `data`, but only if it can be read back. Anything the loader
// would refuse (an Infinity that became null, an invalid date) is rejected HERE, at
// the moment of the bad edit, instead of surfacing as a locked-out app on the next
// launch. Throws an Error whose message is safe to show.
export function serializeChecked(data: AppData): string {
  const text = serialize(data)
  try {
    deserialize(text)
  } catch {
    throw new Error("The last change couldn't be saved because it contains a value Cairn can't store.")
  }
  return text
}

// ---------- validation ----------

const STATUSES = ['todo', 'doing', 'done', 'dropped']
const KINDS = ['time', 'count', 'completion', 'amount']
const PERIODS = ['day', 'week', 'month']
const SOURCES = ['linked', 'any', 'todo', 'quick', 'each']
const ORIGINS = ['todo', 'quick', 'logged']

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}
const isString = (x: unknown): x is string => typeof x === 'string'
const isStringArray = (x: unknown): x is string[] => Array.isArray(x) && x.every(isString)
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const validDate = (x: unknown): boolean => isString(x) && !Number.isNaN(new Date(x).getTime())
const optional = (x: unknown, check: (v: unknown) => boolean): boolean => x === undefined || x === null || check(x)

function validWin(w: unknown): boolean {
  return (
    isRecord(w) &&
    isString(w.id) &&
    isString(w.title) &&
    isString(w.status) &&
    STATUSES.includes(w.status) &&
    validDate(w.createdAt) &&
    optional(w.completedAt, validDate) &&
    // A finished win with no completion time would silently vanish from every report.
    (w.status !== 'done' || validDate(w.completedAt)) &&
    isStringArray(w.goalIds) &&
    isStringArray(w.areas) &&
    optional(w.amount, isNumber) &&
    optional(w.origin, (o) => isString(o) && ORIGINS.includes(o)) &&
    optional(w.quickWinId, isString)
  )
}

function validEntry(e: unknown): boolean {
  return (
    isRecord(e) &&
    isString(e.id) &&
    validDate(e.at) &&
    isNumber(e.minutes) &&
    e.minutes >= 0 &&
    optional(e.title, isString) &&
    optional(e.winId, isString) &&
    isStringArray(e.goalIds) &&
    isStringArray(e.areas)
  )
}

// Only some rules make sense for each kind of goal (the app never makes the others).
const SOURCES_FOR_KIND: Record<string, string[]> = {
  time: ['linked', 'any'],
  count: SOURCES,
  amount: ['linked'],
  completion: ['linked'],
}
function sourceFitsKind(kind: unknown, source: unknown): boolean {
  return source === undefined || source === null || (isString(kind) && (SOURCES_FOR_KIND[kind] ?? []).includes(source as string))
}

function validGoal(g: unknown): boolean {
  return (
    isRecord(g) &&
    isString(g.id) &&
    isString(g.title) &&
    isString(g.kind) &&
    KINDS.includes(g.kind) &&
    optional(g.period, (p) => isString(p) && PERIODS.includes(p)) &&
    isStringArray(g.areas) &&
    Array.isArray(g.targets) &&
    g.targets.every((t) => isRecord(t) && validDate(t.from) && isNumber(t.amount)) &&
    optional(g.childIds, isStringArray) &&
    optional(g.archivedAt, validDate) &&
    optional(g.source, (s) => isString(s) && SOURCES.includes(s)) &&
    sourceFitsKind(g.kind, g.source) &&
    optional(g.tracked, (v) => v === false) &&
    (g.tracked === undefined || g.tracked === null || g.source === 'each')
  )
}

function validArea(a: unknown): boolean {
  return (
    isRecord(a) &&
    isString(a.id) &&
    isString(a.name) &&
    optional(a.onToday, (v) => typeof v === 'boolean') &&
    isNumber(a.colour) &&
    Number.isInteger(a.colour) &&
    a.colour >= 1 &&
    a.colour <= PALETTE_SIZE
  )
}

function validQuickWin(q: unknown): boolean {
  return (
    isRecord(q) &&
    isString(q.id) &&
    isString(q.title) &&
    isStringArray(q.areas) &&
    isStringArray(q.goalIds) &&
    optional(q.minutes, isNumber) &&
    optional(q.amount, isNumber) &&
    optional(q.askMinutes, (v) => typeof v === 'boolean') &&
    isNumber(q.uses)
  )
}

function validTimer(t: unknown): boolean {
  return (
    isRecord(t) &&
    validDate(t.startedAt) &&
    isString(t.title) &&
    optional(t.winId, isString) &&
    optional(t.quickWinId, isString) &&
    isStringArray(t.areas) &&
    isStringArray(t.goalIds)
  )
}

const hasUniqueIds = (items: { id: unknown }[]) => new Set(items.map((i) => i.id)).size === items.length

// Overarching goals that include each other (or themselves) would make the progress
// calculation recurse forever.
function hasChildCycle(goals: { id: string; childIds?: string[] | null }[]): boolean {
  const children = new Map(goals.map((g) => [g.id, g.childIds ?? []]))
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (id: string): boolean => {
    if (state.get(id) === 'visiting') return true
    if (state.get(id) === 'done') return false
    state.set(id, 'visiting')
    const cyclic = (children.get(id) ?? []).some((child) => children.has(child) && visit(child))
    state.set(id, 'done')
    return cyclic
  }
  return [...children.keys()].some(visit)
}

const DAMAGED = 'Some entries in the backup are damaged, so nothing was imported.'
const INCOMPLETE = 'The backup is missing some of its data.'

// Parses and checks text produced by `serialize`. Throws an Error with a message
// that is safe to show to the user.
export function deserialize(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (!isRecord(raw) || raw.version !== DATA_VERSION) {
    throw new Error("That doesn't look like a Cairn backup (or it's from a different version).")
  }

  const { goals, wins, timeEntries, areas, quickWins, timer, otherOnToday } = raw
  if (!Array.isArray(goals) || !Array.isArray(wins) || !Array.isArray(timeEntries)) throw new Error(INCOMPLETE)
  if (areas !== undefined && !Array.isArray(areas)) throw new Error(INCOMPLETE)
  if (quickWins !== undefined && !Array.isArray(quickWins)) throw new Error(INCOMPLETE)

  const ok =
    goals.every(validGoal) &&
    wins.every(validWin) &&
    timeEntries.every(validEntry) &&
    (areas ?? []).every(validArea) &&
    (quickWins ?? []).every(validQuickWin) &&
    optional(timer, validTimer) &&
    optional(otherOnToday, (v) => typeof v === 'boolean') &&
    hasUniqueIds(goals as { id: unknown }[]) &&
    hasUniqueIds(wins as { id: unknown }[]) &&
    hasUniqueIds(timeEntries as { id: unknown }[]) &&
    hasUniqueIds((areas ?? []) as { id: unknown }[]) &&
    hasUniqueIds((quickWins ?? []) as { id: unknown }[]) &&
    !hasChildCycle(goals as { id: string; childIds?: string[] }[])
  if (!ok) throw new Error(DAMAGED)

  const stored = raw as unknown as Stored
  return {
    // Data saved before areas became editable has no `areas`: seed the starters.
    areas: stored.areas ?? DEFAULT_AREAS,
    quickWins: stored.quickWins ?? [],
    ...(stored.otherOnToday === false ? { otherOnToday: false } : {}),
    timer: stored.timer ? { ...stored.timer, startedAt: new Date(stored.timer.startedAt) } : null,
    goals: stored.goals.map((g) => ({
      ...reviveGoal(g),
      period: g.period ?? ('week' as const),
      archivedAt: g.archivedAt ? new Date(g.archivedAt) : undefined,
    })),
    wins: stored.wins.map((w) => ({
      ...w,
      createdAt: new Date(w.createdAt),
      completedAt: w.completedAt ? new Date(w.completedAt) : undefined,
    })),
    timeEntries: stored.timeEntries.map((e) => ({ ...e, at: new Date(e.at) })),
  }
}
