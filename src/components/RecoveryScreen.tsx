import { useState } from 'react'
import { deserialize } from '../serialize'
import { stashUnreadable } from '../storage'
import type { AppData } from '../types'

type Props = {
  message: string
  raw: string | null // the stored text exactly as it is, if there is any
  onRestore: (data: AppData) => void
  onStartFresh: () => void
}

// Shown instead of a blank page when the saved data can't be read. Nothing here
// writes over the stored data until you choose to, and a copy is kept first.
export function RecoveryScreen({ message, raw, onRestore, onStartFresh }: Props) {
  const [problem, setProblem] = useState<string | null>(null)

  function downloadRaw() {
    if (!raw) return
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'cairn-unreadable-data.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const data = deserialize(await file.text())
      if (raw) stashUnreadable(raw, new Date())
      onRestore(data)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Couldn't read that file.")
    }
  }

  function startFresh() {
    if (!window.confirm('Start with an empty Cairn? A copy of the unreadable data is kept on this device first.')) return
    if (raw) stashUnreadable(raw, new Date())
    onStartFresh()
  }

  return (
    <main className="home">
      <h1>Let's get you back</h1>
      <section className="card">
        <p>Cairn couldn't read the data saved on this device, so it hasn't touched it.</p>
        <p className="muted">{message}</p>
      </section>

      {raw && (
        <section className="card">
          <h2>Keep a copy</h2>
          <p className="muted">Save the unreadable data to a file before doing anything else.</p>
          <button className="secondary" onClick={downloadRaw}>
            Download it
          </button>
        </section>
      )}

      <section className="card">
        <h2>Restore from a backup</h2>
        <label className="file-button">
          Choose a backup file
          <input type="file" accept=".json,application/json" onChange={chooseFile} />
        </label>
        {problem && (
          <p className="muted" role="alert">
            {problem}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Start fresh</h2>
        <button className="link" onClick={startFresh}>
          Start with an empty Cairn
        </button>
      </section>
    </main>
  )
}
