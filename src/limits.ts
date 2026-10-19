// Sane limits for typed-in numbers. A value like 1e307 passes a plain <input type=number>
// but turns into Infinity or null once saved, which the loader then rejects, so numbers
// are checked here before they ever reach the data.
export const MAX_NUMBER = 100_000

// The number typed, or undefined if it isn't a positive, finite, reasonable amount.
export function positiveNumber(value: string): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= MAX_NUMBER ? n : undefined
}
