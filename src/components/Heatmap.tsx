import { useEffect, useRef } from 'react'
import { startOfDay, type DayTotal } from '../reports'

type Props = {
  days: DayTotal[]
  selected: Date | null
  onSelect: (day: Date) => void
  compact?: boolean // year view: weeks run as scrolling columns with month labels
}

// More wins that day = darker cell. Level 0 is an ordinary empty cell, not a miss.
function heatLevel(count: number): number {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

type CellProps = {
  d: DayTotal
  selectedTime: number | null
  todayTime: number
  compact: boolean
  onSelect: (day: Date) => void
}

function Cell({ d, selectedTime, todayTime, compact, onSelect }: CellProps) {
  return (
    <button
      className={d.day.getTime() === selectedTime ? 'heat-cell selected' : 'heat-cell'}
      data-level={heatLevel(d.count)}
      data-today={d.day.getTime() === todayTime ? 'true' : undefined}
      style={{ background: `var(--heat-${heatLevel(d.count)})` }}
      onClick={() => onSelect(d.day)}
      aria-label={`${d.day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}: ${d.count} logged`}
      title={`${d.day.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${d.count}`}
    >
      {compact ? '' : d.day.getDate()}
    </button>
  )
}

export function Heatmap({ days, selected, onSelect, compact = false }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  // Rows are weekdays Mon..Sun, so pad the first week with blanks.
  const blanks = days.length > 0 ? (days[0].day.getDay() + 6) % 7 : 0
  const selectedTime = selected ? startOfDay(selected).getTime() : null
  const todayTime = startOfDay(new Date()).getTime()

  // The year is wider than the screen: open it scrolled to today (or to the start, for a past year).
  useEffect(() => {
    if (!compact || !scroller.current) return
    const today = scroller.current.querySelector('[data-today]')
    if (today) today.scrollIntoView({ inline: 'center', block: 'nearest' })
    else scroller.current.scrollLeft = 0
  }, [compact, days])

  if (!compact) {
    return (
      <div className="heatmap">
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((d) => (
          <Cell key={d.day.getTime()} d={d} selectedTime={selectedTime} todayTime={todayTime} compact={false} onSelect={onSelect} />
        ))}
      </div>
    )
  }

  // Year view: one column per week, each topped by a month label where a month begins.
  const padded: (DayTotal | null)[] = [...Array.from({ length: blanks }, () => null), ...days]
  const columns: (DayTotal | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) columns.push(padded.slice(i, i + 7))

  return (
    <div className="heatmap-scroll" ref={scroller}>
      <div className="heatmap heatmap-compact">
        {columns.map((column, c) => {
          // Label the column that holds the 1st of a month, plus the very first column.
          const first =
            column.find((d): d is DayTotal => d !== null && d.day.getDate() === 1) ??
            (c === 0 ? column.find((d): d is DayTotal => d !== null) : undefined)
          return (
            <div className="heat-column" key={c}>
              <span className="month-label">{first ? first.day.toLocaleDateString([], { month: 'short' }) : ''}</span>
              {column.map((d, i) =>
                d ? (
                  <Cell key={d.day.getTime()} d={d} selectedTime={selectedTime} todayTime={todayTime} compact onSelect={onSelect} />
                ) : (
                  <span key={`blank-${c}-${i}`} />
                ),
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
