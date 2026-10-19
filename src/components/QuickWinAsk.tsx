import { useState } from 'react'
import { MAX_NUMBER, positiveNumber } from '../limits'
import type { QuickWin } from '../types'

type Props = {
  quickWin: QuickWin
  onLog: (minutes?: number) => void
  onCancel: () => void
}

// Shown after tapping a repeatable task that asks how long: the minutes become a time
// entry attached to the win. "Just log it" records the win with no time (or its usual minutes).
export function QuickWinAsk({ quickWin, onLog, onCancel }: Props) {
  const [minutes, setMinutes] = useState(quickWin.minutes ? String(quickWin.minutes) : '')
  const parsed = positiveNumber(minutes)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (parsed !== undefined) onLog(parsed)
  }

  return (
    <form className="card form" onSubmit={handleSubmit} aria-label={`How long was ${quickWin.title}`}>
      <div>How long was “{quickWin.title}”?</div>
      <input
        autoFocus
        type="number"
        min="1"
        max={MAX_NUMBER}
        inputMode="numeric"
        placeholder="Minutes"
        aria-label="Minutes"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <div className="form-buttons">
        <button type="submit" className="primary" disabled={parsed === undefined}>
          Log it
        </button>
        <button type="button" onClick={() => onLog()}>
          Just log it
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
