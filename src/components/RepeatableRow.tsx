import { useState } from 'react'
import { topQuickWins } from '../quickWins'
import type { QuickWin } from '../types'

const ELSE = '' // the "Something else…" option

type Props = {
  quickWins: QuickWin[]
  timerRunning: boolean
  onLog: (id: string) => void
  onStart: (id: string) => void
  onElseLog: () => void
  onElseStart: () => void
}

// One compact row for every repeatable task, however many there are: pick one, then log it
// now or start a timer for it. "Something else…" opens the usual forms to name an activity.
export function RepeatableRow({ quickWins, timerRunning, onLog, onStart, onElseLog, onElseStart }: Props) {
  const ordered = topQuickWins(quickWins, quickWins.length) // most used first
  const [picked, setPicked] = useState<string>(ordered[0]?.id ?? ELSE)
  // The chosen task may have been removed meanwhile: fall back to the first.
  const current = ordered.some((q) => q.id === picked) ? picked : (ordered[0]?.id ?? ELSE)

  return (
    <div className="repeat-row" role="group" aria-label="Repeatable tasks">
      <select aria-label="Repeatable task" value={current} onChange={(e) => setPicked(e.target.value)}>
        {ordered.map((q) => (
          <option key={q.id} value={q.id}>
            {q.title}
          </option>
        ))}
        <option value={ELSE}>Something else…</option>
      </select>
      <button className="secondary" onClick={() => (current === ELSE ? onElseLog() : onLog(current))}>
        ✓ Log
      </button>
      {!timerRunning && (
        <button className="secondary" onClick={() => (current === ELSE ? onElseStart() : onStart(current))}>
          ▶ Start
        </button>
      )}
    </div>
  )
}
