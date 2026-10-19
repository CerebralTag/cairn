// Converting between Dates and what <input type="date"> / "datetime-local" speak.
// Always LOCAL time: passing 'YYYY-MM-DD' straight to new Date() would treat it as
// UTC and can land on the wrong day.

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toDateTimeInput(date: Date): string {
  return `${toDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Returns null for an empty or unreadable value.
export function parseDateTimeInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d, h, min] = match.map(Number)
  const date = new Date(y, m - 1, d, h, min)
  return Number.isNaN(date.getTime()) ? null : date
}
