import { useState } from 'react'
import { parseDateInput, toDateInput } from '../dates'
import { addDays, formatMinutes } from '../goals'
import {
  activityFor,
  bestStretch,
  byArea,
  customRange,
  dailyTotals,
  dayRange,
  monthRange,
  totalsFor,
  weekRange,
  yearRange,
  type DateRange,
} from '../reports'
import type { AppData } from '../types'
import { AreaTimeChart } from './AreaTimeChart'
import { GoalHistoryChart } from './GoalHistoryChart'
import { Heatmap } from './Heatmap'
import { LogScreen, type LogHandlers } from './LogScreen'
import { TodayWins } from './TodayWins'

type Tab = 'week' | 'month' | 'year' | 'custom'

const TABS: { id: Tab; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
]

function shiftAnchor(tab: Tab, anchor: Date, direction: 1 | -1): Date {
  if (tab === 'week') return addDays(anchor, 7 * direction)
  if (tab === 'month') return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1)
  return new Date(anchor.getFullYear() + direction, 0, 1)
}

function rangeTitle(tab: Tab, range: DateRange): string {
  const last = addDays(range.end, -1)
  if (tab === 'year') return String(range.start.getFullYear())
  if (tab === 'month') return range.start.toLocaleDateString([], { month: 'long', year: 'numeric' })
  const short = { month: 'short', day: 'numeric' } as const
  return `${range.start.toLocaleDateString([], short)} – ${last.toLocaleDateString([], short)}`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="muted">{label}</div>
    </div>
  )
}

export function HistoryScreen({ data, ...logHandlers }: { data: AppData } & LogHandlers) {
  const [tab, setTab] = useState<Tab>('week')
  const [anchor, setAnchor] = useState(new Date())
  const [customFrom, setCustomFrom] = useState(() => toDateInput(addDays(new Date(), -6)))
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [log, setLog] = useState<{ range: DateRange; title: string } | null>(null)

  const range =
    tab === 'week'
      ? weekRange(anchor)
      : tab === 'month'
        ? monthRange(anchor)
        : tab === 'year'
          ? yearRange(anchor)
          : customRange(
              new Date(Math.min(parseDateInput(customFrom).getTime(), parseDateInput(customTo).getTime())),
              new Date(Math.max(parseDateInput(customFrom).getTime(), parseDateInput(customTo).getTime())),
            ) // either order works: the earlier date is the start

  const totals = totalsFor(data, range)
  const days = dailyTotals(data, range)

  function changeTab(next: Tab) {
    setTab(next)
    setSelectedDay(null)
  }

  function shift(direction: 1 | -1) {
    setAnchor(shiftAnchor(tab, anchor, direction))
    setSelectedDay(null)
  }

  if (log) {
    return <LogScreen data={data} range={log.range} title={log.title} onBack={() => setLog(null)} {...logHandlers} />
  }

  return (
    <main className="home">
      <h1>History</h1>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => changeTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'custom' ? (
        <div className="range-picker">
          <input type="date" aria-label="From" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <span className="muted">to</span>
          <input type="date" aria-label="To" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      ) : (
        <div className="range-nav">
          <button onClick={() => shift(-1)} aria-label="Previous">
            ‹
          </button>
          <strong>{rangeTitle(tab, range)}</strong>
          <button onClick={() => shift(1)} aria-label="Next">
            ›
          </button>
        </div>
      )}

      <section className="stats">
        <Stat label="Wins" value={String(totals.count)} />
        <Stat label="Time logged" value={formatMinutes(totals.minutes)} />
        {/* Only the positive count: a ratio against days in the range reads as a shortfall. */}
        <Stat label="Active days" value={String(totals.activeDays)} />
        <Stat label="Best stretch" value={`${bestStretch(days)} ${bestStretch(days) === 1 ? 'day' : 'days'}`} />
      </section>

      <section className="card">
        <h2>Days</h2>
        <Heatmap days={days} selected={selectedDay} onSelect={setSelectedDay} compact={tab === 'year'} />
        <button className="link" onClick={() => setLog({ range, title: tab === 'custom' ? 'Custom range' : rangeTitle(tab, range) })}>
          Full log, edit or delete entries →
        </button>
      </section>

      {selectedDay && (
        <>
          <TodayWins
            items={activityFor(data, dayRange(selectedDay))}
            title={selectedDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            emptyText="Nothing logged this day. Rest counts too."
          />
          <div className="todo-footer">
            <button
              className="link"
              onClick={() =>
                setLog({
                  range: dayRange(selectedDay),
                  title: selectedDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
                })
              }
            >
              Edit this day
            </button>
            <button className="link" onClick={() => setSelectedDay(null)}>
              Close day
            </button>
          </div>
        </>
      )}

      <GoalHistoryChart appData={data} range={range} />
      <AreaTimeChart totals={byArea(data, range)} />
    </main>
  )
}
