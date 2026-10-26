// Which build is running, and whether a newer one is live. Pure helpers plus two small
// browser actions; the build constant itself comes from vite.config.ts.

// `version` is `git describe --tags --always --dirty`: a CalVer tag like 2026.10.21 (or
// 2026.10.21b), `<tag>-<N>-g<sha>` when N commits past a tag, `-dirty` for uncommitted changes,
// or a bare sha when no tag exists.
export type BuildInfo = { version: string; builtAt: string }

export const BUILD_INFO: BuildInfo = __BUILD_INFO__

// Added to the address by "Update" so the page is fetched fresh; removed again once loaded.
export const UPDATE_PARAM = 'fresh'

export const isDirty = (info: BuildInfo): boolean => info.version.endsWith('-dirty')

export type UpdateCheck = { state: 'current' } | { state: 'newer'; version: string } | { state: 'unknown'; reason: string }

// Compare this build with the one the server has (version.json, fetched fresh every time).
export function compareBuilds(running: BuildInfo, live: unknown): UpdateCheck {
  if (typeof live !== 'object' || live === null || typeof (live as BuildInfo).version !== 'string') {
    return { state: 'unknown', reason: "Couldn't read the live version." }
  }
  const version = (live as BuildInfo).version
  if (isDirty(running)) return { state: 'unknown', reason: "This build has uncommitted changes, so it can't be compared." }
  return version === running.version ? { state: 'current' } : { state: 'newer', version }
}

export async function checkForUpdate(running: BuildInfo = BUILD_INFO): Promise<UpdateCheck> {
  try {
    const response = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
    const live: unknown = response.ok ? await response.json().catch(() => null) : null
    // While developing the server answers with the page itself, which isn't JSON.
    if (live === null) return { state: 'unknown', reason: 'No version information here (normal while developing).' }
    return compareBuilds(running, live)
  } catch {
    return { state: 'unknown', reason: "Couldn't reach the server. Are you offline?" }
  }
}

// Whether the server answers right now. Refreshing clears the offline copy first, so it must
// only go ahead when the new files can actually be fetched.
export async function serverReachable(fetchImpl: typeof fetch = fetch, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`./version.json?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export const OFFLINE_REFRESH_MESSAGE = "You're offline, so nothing was changed. The copy saved on this device still works."

// Fetch the newest copy: drop the offline cache and the service worker, then reload. Does nothing
// (and says why) if the server can't be reached, so a refresh can never leave the app unable to
// open. Your data lives elsewhere (localStorage) and is untouched.
export async function refreshApp(): Promise<string | null> {
  if (!(await serverReachable())) return OFFLINE_REFRESH_MESSAGE
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.()
    await Promise.all((registrations ?? []).map((r) => r.unregister()))
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    // Reloading below still helps.
  }
  try {
    // Also refresh the browser's own copy of the page, which it may otherwise reuse for minutes.
    await fetch('./', { cache: 'reload' })
  } catch {
    // The reload below still tries the network.
  }
  // Open the app at a new address: a browser can't answer that from a saved copy, so the page, and
  // every file it names, comes fresh from the server. (main.tsx tidies the address afterwards.)
  const url = new URL(window.location.href)
  url.searchParams.set(UPDATE_PARAM, String(Date.now()))
  window.location.replace(url.toString())
  return null
}
