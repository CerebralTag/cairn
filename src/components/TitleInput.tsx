import { useId, useState } from 'react'
import type { Suggestion } from '../suggest'
import { useSuggest } from '../suggestContext'

type Props = {
  value: string
  onChange: (value: string) => void
  onPick: (suggestion: Suggestion) => void // fill in the rest of the form from the chosen name
  placeholder: string
  autoFocus?: boolean
}

// A text box that suggests names you've used before as you type. Tap (or arrow to and
// press Enter on) a name to use it and fill in what you chose last time.
export function TitleInput({ value, onChange, onPick, placeholder, autoFocus }: Props) {
  const suggest = useSuggest()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const suggestions = open ? suggest(value) : []

  function pick(suggestion: Suggestion) {
    onPick(suggestion)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (suggestions.length > 0) event.preventDefault() // close the list, don't also dismiss a dialog
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' && !open) {
      setOpen(true) // reopen after Escape
      return
    }
    if (suggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((active + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((active - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault() // choosing a name, not submitting the form
      pick(suggestions[active])
    }
  }

  return (
    <div className="suggest">
      <input
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {suggestions.length > 0 && (
        <ul className="suggest-list" id={listId} role="listbox">
          {suggestions.map((s, i) => (
            // The whole row is the option (no button inside it). A name is picked on CLICK, which
            // a touch only produces for a real tap: starting a scroll on a row picks nothing.
            // mousedown is cancelled only so the text box doesn't lose focus (and close the list)
            // before the click arrives.
            <li
              key={s.title}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              {s.title}
              {s.amount !== undefined && <span className="muted"> · {s.amount}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
