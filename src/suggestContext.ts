import { createContext, useContext } from 'react'
import type { Suggestion } from './suggest'

// Name suggestions are wanted by every dialog with a title box. Like areas, they are
// provided once near the top of the app and read where needed.
export const SuggestContext = createContext<(query: string) => Suggestion[]>(() => [])

export function useSuggest() {
  return useContext(SuggestContext)
}
