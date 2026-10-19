import { useState } from 'react'
import { topQuickWins } from '../quickWins'
import type { QuickWin } from '../types'

const SHOWN = 6

type Props = {
  quickWins: QuickWin[]
  onTap: (id: string) => void
  onStartTimer?: (id: string) => void // absent while a timer is already running
  onManage: () => void
}

// One tap logs a win (or asks how long first); ▶ starts a timer that logs the win when stopped. The most-used six are shown; the rest are behind "More".
export function QuickWinChips({ quickWins, onTap, onStartTimer, onManage }: Props) {
  const [showAll, setShowAll] = useState(false)

  if (quickWins.length === 0) {
    return (
      <button className="link" onClick={onManage}>
        + Add repeatable tasks for things you do often
      </button>
    )
  }

  const shown = showAll ? topQuickWins(quickWins, quickWins.length) : topQuickWins(quickWins, SHOWN)

  return (
    <div className="chips" aria-label="Repeatable tasks">
      {shown.map((q) => (
        <span key={q.id} className={onStartTimer ? 'chip-pair' : undefined}>
          <button className="chip quick" onClick={() => onTap(q.id)}>
            {q.title}
          </button>
          {onStartTimer && (
            <button className="chip quick play" aria-label={`Start a timer for ${q.title}`} onClick={() => onStartTimer(q.id)}>
              ▶
            </button>
          )}
        </span>
      ))}
      {quickWins.length > SHOWN && (
        <button className="chip more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Less' : `More (${quickWins.length - SHOWN})`}
        </button>
      )}
    </div>
  )
}
