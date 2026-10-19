import { useState } from 'react'
import { topQuickWins } from '../quickWins'
import type { QuickWin } from '../types'

const SHOWN = 6

type Props = {
  quickWins: QuickWin[]
  onTap: (id: string) => void
  onManage: () => void
}

// One tap logs a win. The most-used six are shown; the rest are behind "More".
export function QuickWinChips({ quickWins, onTap, onManage }: Props) {
  const [showAll, setShowAll] = useState(false)

  if (quickWins.length === 0) {
    return (
      <button className="link" onClick={onManage}>
        + Add quick wins for things you do often
      </button>
    )
  }

  const shown = showAll ? topQuickWins(quickWins, quickWins.length) : topQuickWins(quickWins, SHOWN)

  return (
    <div className="chips" aria-label="Quick wins">
      {shown.map((q) => (
        <button key={q.id} className="chip quick" onClick={() => onTap(q.id)}>
          {q.title}
        </button>
      ))}
      {quickWins.length > SHOWN && (
        <button className="chip more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Less' : `More (${quickWins.length - SHOWN})`}
        </button>
      )}
    </div>
  )
}
