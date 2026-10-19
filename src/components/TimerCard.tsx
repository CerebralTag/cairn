import { useEffect, useState } from 'react'
import { useAreas } from '../areasContext'
import { parseDateTimeInput, toDateTimeInput } from '../dates'
import { formatMinutes } from '../goals'
import { MAX_NUMBER, positiveNumber } from '../limits'
import { elapsedMs, formatElapsed, isLongRunning, type StopOptions } from '../timer'
import type { ActiveTimer } from '../types'

type Props = {
  timer: ActiveTimer
  onStop: (options?: StopOptions) => void
  onDiscard: () => void
}

// Shows the running timer. The display ticks every second, but the value is always
// recomputed from the stored start time, so nothing is lost if the page sleeps.
export function TimerCard({ timer, onStop, onDiscard }: Props) {
  const { colourOf } = useAreas()
  const [now, setNow] = useState(() => new Date())
  const [askingLength, setAskingLength] = useState(false)
  const [minutes, setMinutes] = useState('')
  const [when, setWhen] = useState(() => toDateTimeInput(timer.startedAt))

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    // Phones freeze timers in the background: catch up the moment the app is visible again.
    const onVisible = () => setNow(new Date())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // A timer left running for many hours is almost certainly forgotten: ask how long
  // the session really was instead of saving the whole stretch.
  function stop() {
    if (isLongRunning(timer, new Date())) setAskingLength(true)
    else onStop()
  }

  function saveGivenLength(event: React.FormEvent) {
    event.preventDefault()
    const parsed = positiveNumber(minutes)
    const parsedWhen = parseDateTimeInput(when)
    if (parsed !== undefined && parsedWhen && parsedWhen.getTime() <= Date.now() + 60_000) onStop({ minutes: parsed, at: parsedWhen })
  }

  function discard() {
    if (window.confirm('Discard this timer without saving the time?')) onDiscard()
  }

  return (
    <section className="card timer-card" aria-label="Running timer">
      <div className="timer-head">
        <span className="dot" style={{ background: colourOf(timer.areas[0]) }} />
        <span className="timer-title">{timer.title}</span>
      </div>
      <div className="timer-time" role="timer" aria-live="off">
        {formatElapsed(elapsedMs(timer, now))}
      </div>
      {askingLength ? (
        <form className="form" onSubmit={saveGivenLength}>
          <p className="muted">This has been running a long time. How many minutes was the session really?</p>
          <input autoFocus type="number" min="1" max={MAX_NUMBER} placeholder="Minutes" aria-label="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <label className="field">
            <span className="muted">When it started (change it if you did this earlier or later)</span>
            <input type="datetime-local" value={when} max={toDateTimeInput(new Date())} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <div className="form-buttons">
            <button type="submit" className="primary" disabled={positiveNumber(minutes) === undefined}>
              Save
            </button>
            <button type="button" onClick={() => onStop()}>
              Save all {formatMinutes(Math.round(elapsedMs(timer, now) / 60_000))}
            </button>
            <button type="button" onClick={() => setAskingLength(false)}>
              Back
            </button>
          </div>
        </form>
      ) : (
        <div className="form-buttons">
          <button className="primary" onClick={stop}>
            Stop &amp; save
          </button>
          <button onClick={discard}>Discard</button>
        </div>
      )}
    </section>
  )
}
