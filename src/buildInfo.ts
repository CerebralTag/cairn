// Which build is running, and whether a newer one is live. Pure helpers plus two small
// browser actions; the build constant itself comes from vite.config.ts.

export type BuildInfo = { commit: string; dirty: boolean; builtAt: string }

export const BUILD_INFO: BuildInfo = __BUILD_INFO__

// "223deb9", or "223deb9 + changes" when it was built with uncommitted changes.
export function versionLabel(info: BuildInfo): string {
  return info.dirty ? `${info.commit} + changes` : info.commit
}

export type UpdateCheck = { state: 'current' } | { state: 'newer'; commit: string } | { state: 'unknown'; reason: string }

// Compare this build with the one the server has (version.json, fetched fresh every time).
export function compareBuilds(running: BuildInfo, live: unknown): UpdateCheck {
  if (typeof live !== 'object' || live === null || typeof (live as BuildInfo).commit !== 'string') {
    return { state: 'unknown', reason: "Couldn't read the live version." }
  }
  const commit = (live as BuildInfo).commit
  if (running.dirty) return { state: 'unknown', reason: 'This build has uncommitted changes, so it can\'t be compared.' }
  return commit === running.commit ? { state: 'current' } : { state: 'newer', commit }
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

// Fetch the newest copy: drop the offline cache and the service worker, then reload. Your data
// lives elsewhere (localStorage) and is untouched.
export async function refreshApp(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.()
    await Promise.all((registrations ?? []).map((r) => r.unregister()))
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    // Reloading below still helps.
  }
  window.location.reload()
}
