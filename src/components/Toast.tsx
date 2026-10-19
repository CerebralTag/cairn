import { useEffect } from 'react'

type Props = {
  id: string // changes with each message, restarting the timer
  message: string
  onUndo?: () => void // omitted when there is nothing to undo
  onDismiss: () => void // keep this stable (useCallback), or every re-render restarts the timer
}

const VISIBLE_MS = 7000

export function Toast({ id, message, onUndo, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS)
    return () => clearTimeout(timer) // runs when the message changes or this unmounts
  }, [id, onDismiss])

  return (
    <div className="toast" role="status">
      <span>{message}</span>
      {onUndo && <button onClick={onUndo}>Undo</button>}
    </div>
  )
}
