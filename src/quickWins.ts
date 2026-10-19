// Quick wins: one-tap templates for wins ("10 squats"). Tapping one logs an ordinary
// win with the template's amount, areas and goal links (and minutes, if it has them).
import { goalSource, isActive, periodStartFor, progressFor, progressLabel, targetFor } from './goals'
import { nameKey } from './suggest'
import type { AppData, QuickWin, TimeEntry, Win } from './types'

// The first `count` templates, most used first; ties keep their saved order.
export function topQuickWins(quickWins: QuickWin[], count: number): QuickWin[] {
  return [...quickWins].sort((a, b) => b.uses - a.uses).slice(0, count)
}

// Log a quick win as a finished win stamped `now`. Returns the new data and the
// new win's id (so the tap can be undone), or null if the template is gone.
// `minutes` replaces the template's own minutes (typed on tap, or measured by a timer that
// started at `startedAt`).
export type QuickWinOptions = { minutes?: number; startedAt?: Date }

export function applyQuickWin(
  data: AppData,
  quickWinId: string,
  now: Date,
  options: QuickWinOptions = {},
): { data: AppData; winId: string } | null {
  const template = data.quickWins.find((q) => q.id === quickWinId)
  if (!template) return null

  const winId = crypto.randomUUID()
  const win: Win = {
    id: winId,
    title: template.title,
    status: 'done',
    createdAt: now,
    completedAt: now,
    goalIds: template.goalIds,
    areas: template.areas,
    amount: template.amount,
    origin: 'quick',
    quickWinId: template.id,
  }
  const minutes = options.minutes ?? template.minutes
  const entry: TimeEntry | null = minutes
    ? { id: crypto.randomUUID(), at: options.startedAt ?? now, minutes, winId, goalIds: [], areas: [] }
    : null

  return {
    winId,
    data: {
      ...data,
      wins: [win, ...data.wins],
      timeEntries: entry ? [...data.timeEntries, entry] : data.timeEntries,
      quickWins: data.quickWins.map((q) => (q.id === quickWinId ? { ...q, uses: q.uses + 1 } : q)),
    },
  }
}

// Reverse a tap: remove the win and its time, and give back the use.
export function undoQuickWin(data: AppData, winId: string, quickWinId: string): AppData {
  return {
    ...data,
    wins: data.wins.filter((w) => w.id !== winId),
    timeEntries: data.timeEntries.filter((e) => e.winId !== winId),
    quickWins: data.quickWins.map((q) => (q.id === quickWinId ? { ...q, uses: Math.max(0, q.uses - 1) } : q)),
  }
}

// What a win contributes to right now, as short lines for the confirmation:
// "Squats: 40 of 100". Only goals this win counts toward (linked to it, or counted by a rule
// it meets) and that have a target this period appear, so a win that counts toward nothing
// is simply a win and the list is empty.
export function contributionsFor(data: AppData, winId: string, now: Date): string[] {
  const win = data.wins.find((w) => w.id === winId)
  if (!win) return []
  const hasTime = data.timeEntries.some((e) => e.winId === winId)
  // A goal is helped by this win if it is linked to it, or counts by a rule this win meets.
  const helps = (g: (typeof data.goals)[number]): boolean => {
    switch (goalSource(g)) {
      case 'any':
        return g.kind === 'time' ? hasTime : win.status === 'done'
      case 'todo':
        return win.status === 'done' && win.origin === 'todo'
      case 'quick':
        return win.status === 'done' && win.origin === 'quick'
      default:
        return win.goalIds.includes(g.id)
    }
  }
  return data.goals
    .filter((g) => !g.childIds && isActive(g))
    .filter(helps)
    .filter((g) => (targetFor(g, periodStartFor(g.period, now)) ?? 0) > 0)
    .map((g) => `${g.title}: ${progressLabel(g, progressFor(g, data, periodStartFor(g.period, now)))}`)
}

// ---- Applying a changed template to wins already logged ----
//
// Each tap on a quick win copies its areas, goals and amount into an ordinary win, so
// editing the template later doesn't touch those wins. These let you bring earlier wins
// up to date: they are found by NAME (the same comparison as the suggestions, so
// "Mow the lawn" and "mow the lawn!" are one name), optionally only since a date.

// Finished wins with this name, newest first, optionally only those finished since `since`.
// When the quick win's id is given, wins tapped from that quick win are found by identity,
// even if they have since been renamed; wins from before that was recorded fall back to the name.
export function winsNamed(wins: Win[], title: string, since?: Date, templateId?: string): Win[] {
  const key = nameKey(title)
  return wins
    .filter(
      (w) =>
        w.status === 'done' &&
        w.completedAt !== undefined &&
        ((templateId !== undefined && w.quickWinId === templateId) || nameKey(w.title) === key) &&
        (since === undefined || w.completedAt.getTime() >= since.getTime()),
    )
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
}

// Whether a template has anything to add to earlier wins.
export function templateHasDetails(template: QuickWin): boolean {
  return template.areas.length > 0 || template.goalIds.length > 0 || template.amount !== undefined
}

// ADD the template's areas and goals to the matching wins, and its amount to those that
// have none. Nothing is ever removed or overwritten, so a link you added by hand stays.
// Returns the new data and the ids of the wins that actually changed.
export function applyTemplateToWins(
  data: AppData,
  template: QuickWin,
  matchTitle: string,
  since?: Date,
): { data: AppData; changedIds: string[] } {
  const targets = new Set(winsNamed(data.wins, matchTitle, since, template.id).map((w) => w.id))
  const areaIds = new Set(data.areas.map((a) => a.id))
  const activeGoals = new Set(data.goals.filter(isActive).map((g) => g.id))
  const addAreas = template.areas.filter((a) => areaIds.has(a))
  const addGoals = template.goalIds.filter((g) => activeGoals.has(g))
  const changedIds: string[] = []

  const wins = data.wins.map((w) => {
    if (!targets.has(w.id)) return w
    const areas = [...new Set([...w.areas, ...addAreas])]
    const goalIds = [...new Set([...w.goalIds, ...addGoals])]
    const amount = w.amount ?? template.amount
    const changed = areas.length !== w.areas.length || goalIds.length !== w.goalIds.length || amount !== w.amount
    if (!changed) return w
    changedIds.push(w.id)
    return { ...w, areas, goalIds, amount }
  })
  return { data: { ...data, wins }, changedIds }
}

// Undo an applyTemplateToWins: take back ONLY what it added (the template's areas and goals
// that the win did not have before, and its amount if the win had none), so anything else
// done to those wins since, such as a rename or another link, is kept.
export function revertTemplateApplication(data: AppData, template: QuickWin, before: Win[]): AppData {
  const prior = new Map(before.map((w) => [w.id, w]))
  return {
    ...data,
    wins: data.wins.map((w) => {
      const p = prior.get(w.id)
      if (!p) return w
      const addedAreas = new Set(template.areas.filter((a) => !p.areas.includes(a)))
      const addedGoals = new Set(template.goalIds.filter((g) => !p.goalIds.includes(g)))
      return {
        ...w,
        areas: w.areas.filter((a) => !addedAreas.has(a)),
        goalIds: w.goalIds.filter((g) => !addedGoals.has(g)),
        amount: p.amount === undefined && w.amount === template.amount ? undefined : w.amount,
      }
    }),
  }
}
