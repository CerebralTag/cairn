// Backup file helpers. Pure functions here; the browser calls live in BackupPanel.
import { serialize } from './serialize'
import type { AppData } from './types'

export function backupFilename(now: Date): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `cairn-backup-${now.getFullYear()}-${mm}-${dd}.json`
}

// A backup is the normal saved format plus a note of what and when.
// A running timer is not part of a backup: restoring one later would revive a stale
// start time. Only saved history goes in.
export function backupText(data: AppData, now: Date): string {
  return serialize({ ...data, timer: null }, { app: 'cairn', exportedAt: now.toISOString() })
}

export function summarise(data: AppData): string {
  const done = data.wins.filter((w) => w.status === 'done').length
  const open = data.wins.filter((w) => w.status === 'todo' || w.status === 'doing').length
  const parts = [
    `${done} ${done === 1 ? 'win' : 'wins'}`,
    `${open} open ${open === 1 ? 'task' : 'tasks'}`,
    `${data.timeEntries.length} time ${data.timeEntries.length === 1 ? 'entry' : 'entries'}`,
    `${data.goals.length} ${data.goals.length === 1 ? 'goal' : 'goals'}`,
    `${data.areas.length} ${data.areas.length === 1 ? 'area' : 'areas'}`,
  ]
  return parts.join(', ')
}

// A calm, factual note. Deliberately never says "overdue" or "late".
export function describeAgo(from: Date, now: Date): string {
  const days = Math.floor((now.getTime() - from.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}
