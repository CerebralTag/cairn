// The "what you've done today" strip in the Today header. One bead per finished win,
// whether or not it counts toward any goal, so every win has presence. By design there
// are no empty placeholder beads, no targets and no milestones: it only shows what
// has been done.
import type { ActivityItem } from './reports'

export type BeadSummary = {
  wins: ActivityItem[] // finished wins, oldest first, so the row grows to the right
  minutes: number // all time logged in the range (finished wins, progress and standalone time)
}

export function summariseToday(items: ActivityItem[]): BeadSummary {
  return {
    wins: items.filter((i) => i.kind === 'win').sort((a, b) => a.at.getTime() - b.at.getTime()),
    // Activity items already fold a win's own sessions into the win, so nothing is counted twice.
    minutes: items.reduce((sum, i) => sum + i.minutes, 0),
  }
}

// "4 wins today · 1h 20m logged", or just the time if nothing was finished yet. `when` is the
// stretch the items cover ("today", "this week").
export function beadCaption(summary: BeadSummary, formatMinutes: (m: number) => string, when = 'today'): string {
  const parts: string[] = []
  if (summary.wins.length > 0) parts.push(`${summary.wins.length} ${summary.wins.length === 1 ? 'win' : 'wins'} ${when}`)
  if (summary.minutes > 0) parts.push(`${formatMinutes(summary.minutes)} logged`)
  return parts.join(' · ')
}
