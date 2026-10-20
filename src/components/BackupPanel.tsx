import { useEffect, useState } from 'react'
import { backupFilename, backupText, describeAgo, summarise } from '../backup'
import { deserialize } from '../serialize'
import { loadLastBackup, saveLastBackup } from '../storage'
import type { AppData } from '../types'

type Props = {
  data: AppData
  onImport: (data: AppData) => void
  onReset: () => void // erase everything (for testing)
}

type Pending = { data: AppData; fileName: string }

// Everything lives on this device, so the backup file is the safety net. The
// note about the last backup is informational only: no warnings, no nagging.
export function BackupPanel({ data, onImport, onReset }: Props) {
  const [lastBackup, setLastBackup] = useState<Date | null>(null)
  const [now] = useState(() => new Date())
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  useEffect(() => {
    async function load() {
      setLastBackup(await loadLastBackup())
    }
    load()
  }, [])

  async function exportBackup() {
    setMessage(null)
    const stamp = new Date()
    const filename = backupFilename(stamp)
    const file = new File([backupText(data, stamp)], filename, { type: 'application/json' })
    try {
      // On iPhone the share sheet offers "Save to Files" (and iCloud Drive).
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Cairn backup' })
      } else {
        const url = URL.createObjectURL(file)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
      }
      await saveLastBackup(stamp)
      setLastBackup(stamp)
      setMessage('Backup saved.')
    } catch (error) {
      // Closing the share sheet is not an error worth reporting.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessage("Couldn't create the backup. Please try again.")
      }
    }
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // lets the same file be picked again later
    if (!file) return
    setMessage(null)
    try {
      setPending({ data: deserialize(await file.text()), fileName: file.name })
    } catch (error) {
      setPending(null)
      setMessage(error instanceof Error ? error.message : "Couldn't read that file.")
    }
  }

  function confirmImport() {
    if (!pending) return
    onImport(pending.data)
    setPending(null)
    setMessage('Imported. Your data has been replaced with the backup.')
  }

  return (
    <>
      <section className="card">
        <h2>Back up</h2>
        <p className="muted">
          Your data is stored only on this device. Save a copy to Files or iCloud Drive now and then.{' '}
          {lastBackup ? `Last backup: ${describeAgo(lastBackup, now)}.` : 'No backup yet.'}
        </p>
        <button className="did-something" onClick={exportBackup}>
          Export a backup
        </button>
      </section>

      <section className="card">
        <h2>Restore</h2>
        <p className="muted">Replaces everything here with the contents of a backup file.</p>
        <label className="file-button">
          Choose a backup file
          <input type="file" accept=".json,application/json" onChange={chooseFile} />
        </label>

        {pending && (
          <div className="pending">
            <p>
              <strong>{pending.fileName}</strong>
              <br />
              {summarise(pending.data)}
            </p>
            <p className="muted">This will replace your current data. Export first if you want to keep it.</p>
            <div className="form-buttons">
              <button className="primary" onClick={confirmImport}>
                Replace my data
              </button>
              <button onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Start over</h2>
        <p className="muted">Erases every win, goal, task, area and timer on this device and starts fresh, handy for testing. Export a backup first if you want to keep anything.</p>
        <button
          className="secondary"
          onClick={() => {
            if (window.confirm('Erase everything on this device and start over?')) onReset()
          }}
        >
          Erase everything
        </button>
      </section>

      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
    </>
  )
}
