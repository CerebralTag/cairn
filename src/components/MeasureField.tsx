import { MAX_NUMBER } from '../limits'

export type MeasureKind = 'time' | 'number'
export type Measure = { kind: MeasureKind; value: string }

// One optional number with a choice of what it is: minutes of time, or a plain number
// ("10" squats). Replaces two separate boxes so the form stays short.
export function MeasureField({
  measure,
  onChange,
  numberOnly = false,
}: {
  measure: Measure
  onChange: (m: Measure) => void
  numberOnly?: boolean // no time choice (a to-do's time comes from sessions later)
}) {
  return (
    <div className="measure">
      {!numberOnly && (
      <select aria-label="Time or number" value={measure.kind} onChange={(e) => onChange({ ...measure, kind: e.target.value as MeasureKind })}>
        <option value="time">Time (minutes)</option>
        <option value="number">Number</option>
      </select>
      )}
      <input
        type="number"
        min="1"
        max={MAX_NUMBER}
        aria-label={measure.kind === 'time' && !numberOnly ? 'Minutes' : 'Amount'}
        placeholder={numberOnly ? 'Amount (optional, like 10)' : 'Optional'}
        value={measure.value}
        onChange={(e) => onChange({ ...measure, value: e.target.value })}
      />
    </div>
  )
}
