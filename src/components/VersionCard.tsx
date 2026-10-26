import { useEffect, useState } from 'react'
import { BUILD_INFO, checkForUpdate, refreshApp, type UpdateCheck } from '../buildInfo'

// A small line at the bottom of Manage: which build this is, with a way to check for a newer one.
export function VersionCard() {
  const [result, setResult] = useState<UpdateCheck | null>(null)
  const [checking, setChecking] = useState(false)

  const [refreshNote, setRefreshNote] = useState<string | null>(null)
  // Where this copy came from and which saved offline copy is in use, to explain a stuck version.
  const [copies, setCopies] = useState<string>('')
  useEffect(() => {
    let live = true
    caches
      ?.keys()
      .then((keys) => live && setCopies(keys.length > 0 ? keys.map((k) => k.replace(/^cairn-/, '')).join(', ') : 'none'))
      .catch(() => live && setCopies(''))
    return () => {
      live = false
    }
  }, [])

  async function refresh() {
    setRefreshNote(null)
    setRefreshNote(await refreshApp())
  }

  async function check() {
    setChecking(true)
    setResult(await checkForUpdate())
    setChecking(false)
  }

  return (
    <section className="card version-card" aria-label="Version">
      <div className="muted">
        Version <strong>{BUILD_INFO.version}</strong> · built {new Date(BUILD_INFO.builtAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
      </div>
      <div className="muted version-detail">
        From {window.location.host}
        {copies && ` · offline copy ${copies}`}
      </div>
      <div className="form-buttons">
        <button onClick={check} disabled={checking}>
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {result?.state === 'newer' && (
          <button className="primary" onClick={refresh}>
            Update to {result.version}
          </button>
        )}
        <button className="link" onClick={refresh}>
          Reload fresh
        </button>
      </div>
      {refreshNote && (
        <p className="muted" role="status">
          {refreshNote}
        </p>
      )}
      {result && (
        <p className="muted" role="status">
          {result.state === 'current' && "You're on the latest version."}
          {result.state === 'newer' && `A newer version (${result.version}) is available.`}
          {result.state === 'unknown' && result.reason}
        </p>
      )}
    </section>
  )
}
