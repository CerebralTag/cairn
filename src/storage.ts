// Persistence layer. Everything here is `async` even though localStorage is
// synchronous, so that swapping in Supabase (a network call) later changes only
// this file, not the components.
import { migrateLegacy, type LegacyGoal, type LegacyTask, type LegacyWin } from './migrate'
import { deserialize, reviveGoal, serializeChecked } from './serialize'
import type { AppData } from './types'

const DATA_KEY = 'cairn.data'
const LAST_BACKUP_KEY = 'cairn.lastBackup'

// Returns null when nothing has been saved yet, so the caller can use defaults.
// If only the first-generation data exists, it is migrated (and left untouched
// in storage; the migrated copy is written under the new key on the next save).
export async function loadData(): Promise<AppData | null> {
  const raw = localStorage.getItem(DATA_KEY)
  if (raw !== null) return deserialize(raw)
  return loadLegacy()
}

// Writes only data that can be read back, so storage never holds something that locks
// the app out on the next launch. Throws (with a message safe to show) if it can't save,
// either because the data is unstorable or because the device storage is full.
export async function saveData(data: AppData): Promise<void> {
  const text = serializeChecked(data)
  try {
    localStorage.setItem(DATA_KEY, text)
  } catch {
    throw new Error("This device's storage is full, so the last change couldn't be saved.")
  }
}

export const DATA_STORAGE_KEY = DATA_KEY

// The stored text exactly as it is, even if it can't be parsed. Used by the
// recovery screen so unreadable data can still be saved elsewhere.
export function readRawData(): string | null {
  try {
    return localStorage.getItem(DATA_KEY)
  } catch {
    return null
  }
}

// Keep a copy of unreadable data under its own key before anything overwrites it.
export function stashUnreadable(raw: string, now: Date): void {
  try {
    localStorage.setItem(`cairn.unreadable.${now.toISOString()}`, raw)
  } catch {
    // Storage full: nothing more we can do, and the recovery screen already offered a download.
  }
}

export async function loadLastBackup(): Promise<Date | null> {
  const raw = localStorage.getItem(LAST_BACKUP_KEY)
  return raw ? new Date(raw) : null
}

export async function saveLastBackup(at: Date): Promise<void> {
  localStorage.setItem(LAST_BACKUP_KEY, at.toISOString())
}

// Ask the browser not to evict our storage under pressure. iOS may decline or
// ignore this; it costs nothing to ask.
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

function loadLegacy(): AppData | null {
  const rawWins = localStorage.getItem('cairn.wins')
  const rawTasks = localStorage.getItem('cairn.tasks')
  const rawGoals = localStorage.getItem('cairn.goals')
  if (rawWins === null && rawTasks === null && rawGoals === null) return null

  type OldGoal = Omit<LegacyGoal, 'targets'> & { targets: { from: string; amount: number }[] }
  const wins = (rawWins ? (JSON.parse(rawWins) as (Omit<LegacyWin, 'at'> & { at: string })[]) : []).map(
    (w) => ({ ...w, at: new Date(w.at) }),
  )
  const tasks = rawTasks ? (JSON.parse(rawTasks) as LegacyTask[]) : []
  const goals: LegacyGoal[] = rawGoals ? (JSON.parse(rawGoals) as OldGoal[]).map((g) => reviveGoal(g)) : []

  return migrateLegacy({ wins, tasks, goals }, new Date())
}
