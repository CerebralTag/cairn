// The timer. Only the start time is stored, so elapsed time is always derived and
// stays correct across app restarts, suspended tabs and a locked phone.
import type { ActiveTimer, AppData, Area, TimeEntry } from './types'

export type TimerInput = { title: string; winId?: string; areas: Area[]; goalIds: string[] }

// Starting while one is already running does nothing: there is only ever one.
export function startTimer(data: AppData, input: TimerInput, now: Date): AppData {
  if (data.timer) return data
  return { ...data, timer: { startedAt: now, ...input } }
}

export function elapsedMs(timer: ActiveTimer, now: Date): number {
  return Math.max(0, now.getTime() - timer.startedAt.getTime())
}

// A timer left running this long is probably forgotten: the app asks how long the
// session really was instead of silently saving days of time.
export const LONG_TIMER_MS = 8 * 60 * 60 * 1000

export function isLongRunning(timer: ActiveTimer, now: Date): boolean {
  return elapsedMs(timer, now) > LONG_TIMER_MS
}

// Stop and save the session as a time entry that begins when the timer started.
// Anything under a minute is saved as one minute, so a quick session still counts.
// For a forgotten timer, `minutes` overrides the elapsed time and `at` says when the
// session really began (it defaults to when the timer was started).
export type StopOptions = { minutes?: number; at?: Date }

export function stopTimer(data: AppData, now: Date, options: StopOptions = {}): { data: AppData; entry: TimeEntry | null } {
  const timer = data.timer
  if (!timer) return { data, entry: null }

  // If the task was deleted while the timer ran, keep the time as a standalone entry.
  const attached = timer.winId !== undefined && data.wins.some((w) => w.id === timer.winId)
  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    at: options.at ?? timer.startedAt,
    minutes:
      options.minutes !== undefined
        ? Math.max(1, Math.round(options.minutes))
        : Math.max(1, Math.round(elapsedMs(timer, now) / 60_000)),
    title: attached ? undefined : timer.title,
    winId: attached ? timer.winId : undefined,
    goalIds: timer.goalIds,
    areas: timer.areas,
  }
  return { data: { ...data, timer: null, timeEntries: [...data.timeEntries, entry] }, entry }
}

export function discardTimer(data: AppData): AppData {
  return { ...data, timer: null }
}

// 7:05 or 1:02:09
export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
