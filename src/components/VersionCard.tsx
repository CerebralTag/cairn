import { useState } from 'react'
import { BUILD_INFO, checkForUpdate, refreshApp, versionLabel, type UpdateCheck } from '../buildInfo'

// A small line at the bottom of Manage: which build this is, with a way to check for a newer one.
export function VersionCard() {
  const [result, setResult] = useState<UpdateCheck | null>(null)
  const [checking, setChecking] = useState(false)

  async function check() {
    setChecking(true)
    setResult(await checkForUpdate())
    setChecking(false)
  }

  return (
    <section className="card version-card" aria-label="Version">
      <div className="muted">
        Version <strong>{versionLabel(BUILD_INFO)}</strong> · built {new Date(BUILD_INFO.builtAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
      </div>
      <div className="form-buttons">
        <button onClick={check} disabled={checking}>
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {result?.state === 'newer' && (
          <button className="primary" onClick={refreshApp}>
            Update to {result.commit}
          </button>
        )}
        <button className="link" onClick={refreshApp}>
          Reload fresh
        </button>
      </div>
      {result && (
        <p className="muted" role="status">
          {result.state === 'current' && "You're on the latest version."}
          {result.state === 'newer' && `A newer version (${result.commit}) is available.`}
          {result.state === 'unknown' && result.reason}
        </p>
      )}
    </section>
  )
}
