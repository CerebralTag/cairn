import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './App.css'
import { DEFAULT_AREAS } from './areas'
import { AreasContext } from './areasContext'
import { makeSuggest } from './suggest'
import { SuggestContext } from './suggestContext'
import { GoalRing } from './components/GoalRing'
import { HistoryScreen } from './components/HistoryScreen'
import { ManageScreen, type ManageTab } from './components/ManageScreen'
import { NavBar, type Screen } from './components/NavBar'
import { OverallCard } from './components/OverallCard'
import { QuickWinChips } from './components/QuickWinChips'
import { RecoveryScreen } from './components/RecoveryScreen'
import { TimerCard } from './components/TimerCard'
import { TodayBeads } from './components/TodayBeads'
import type { TodayEditor } from './components/TodayWins'
import { TimerStarter, type TimerStart } from './components/TimerStarter'
import { Toast } from './components/Toast'
import { TodayWins } from './components/TodayWins'
import { TodoList } from './components/TodoList'
import { WinForm } from './components/WinForm'
import { toDateInput } from './dates'
import { addLoggedWin, addTask, applyEntryEdit, applyWinEdit, deleteEntry, type TimeEntryPatch, type WinValues } from './edits'
import { formatMinutes, isActive, linkByArea, periodStartFor, progressFor } from './goals'
import { archiveGoal, deleteWin, removeArea, removeGoal, restoreGoal, withStatus } from './manage'
import { applyQuickWin, applyTemplateToWins, contributionsFor, revertTemplateApplication, undoQuickWin } from './quickWins'
import { activityFor, dayRange } from './reports'
import { DATA_STORAGE_KEY, loadData, readRawData, requestPersistence, saveData } from './storage'
import { deserialize } from './serialize'
import { discardTimer, startTimer, stopTimer, type StopOptions } from './timer'
import type { AppData, AreaDef, GoalDef, QuickWin, Win, WinStatus } from './types'

const emptyData: AppData = { timer: null, areas: DEFAULT_AREAS, quickWins: [], goals: [], wins: [], timeEntries: [] }

type ToastState = { id: string; message: string; undo?: () => void }

// Everything below needs the areas and the name suggestions, both derived from the data.
function Providers({ data, children }: { data: AppData; children: ReactNode }) {
  const suggest = useMemo(() => makeSuggest(data), [data])
  return (
    <AreasContext.Provider value={data.areas}>
      <SuggestContext.Provider value={suggest}>{children}</SuggestContext.Provider>
    </AreasContext.Provider>
  )
}

function App() {
  // All saved data lives in one object. Updates always build a NEW object
  // (never mutate), so React notices the change and re-renders.
  const [data, setData] = useState<AppData>(emptyData)
  const [logging, setLogging] = useState(false)
  const [startingTimer, setStartingTimer] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null) // the Today entry being fixed
  const [screen, setScreen] = useState<Screen>('today')
  const [manageTab, setManageTab] = useState<ManageTab>('tasks')
  const [toast, setToast] = useState<ToastState | null>(null)
  // Loading is async, so there is a moment where we have no data yet. Until
  // `loaded` is true we must not save, or we'd overwrite stored data with empties.
  const [loaded, setLoaded] = useState(false)
  // If the saved data can't be read, we show a recovery screen and never save over it.
  const [loadError, setLoadError] = useState<{ message: string; raw: string | null } | null>(null)
  // Set when the data was just replaced by another tab's version, so we don't write it straight back.
  const skipNextSave = useRef(false)
  const lastQuickTap = useRef({ id: '', at: 0 })
  const loadedRef = useRef(false) // read inside the storage listener, which is set up once
  // The last version known to be in storage. If a save fails, the screen goes back to this, so
  // what you see is always what is saved.
  const lastSavedRef = useRef<AppData>(emptyData)
  // Set when the latest change could not be stored (unstorable value, or a full device).
  const [saveProblem, setSaveProblem] = useState<string | null>(null)

  // useEffect runs after render. With [] as the dependency list it runs once, on
  // first mount. This is where "load when the screen opens" goes.
  useEffect(() => {
    async function load() {
      try {
        const saved = await loadData()
        lastSavedRef.current = saved ?? emptyData
        setData(saved ?? emptyData) // nothing saved yet: a fresh start
        setLoaded(true)
        requestPersistence() // ask the browser not to evict our storage
      } catch (error) {
        // Leave `loaded` false so nothing is ever saved over the unreadable data.
        setLoadError({ message: error instanceof Error ? error.message : 'Unknown problem.', raw: readRawData() })
      }
    }
    load()
  }, [])

  // Runs after render whenever `data` (or `loaded`) changed: save the new value.
  useEffect(() => {
    if (!loaded) return
    loadedRef.current = true
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    saveData(data).then(
      () => {
        lastSavedRef.current = data
        setSaveProblem(null)
      },
      (error: unknown) => {
        setSaveProblem(error instanceof Error ? error.message : "The last change couldn't be saved.")
        // Undo the change on screen too, so the app never runs ahead of what is stored.
        skipNextSave.current = true
        setData(lastSavedRef.current)
      },
    )
  }, [data, loaded])

  // Another tab or window saved: adopt its version instead of overwriting it later.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      // Before our own data has loaded (e.g. the recovery screen) there is nothing to merge into.
      if (!loadedRef.current) return
      if (event.storageArea !== localStorage || event.key !== DATA_STORAGE_KEY || event.newValue === null) return
      try {
        const next = deserialize(event.newValue)
        lastSavedRef.current = next
        skipNextSave.current = true
        setData(next)
      } catch {
        // An unreadable version from elsewhere is ignored; ours stays as it is.
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  // Today is "today" when you look, even if the app was left open overnight: re-check
  // the date each minute and when the app comes back to the foreground. State only
  // changes when the date does, so this re-renders once a day, not every minute.
  const [, setDayKey] = useState(() => toDateInput(new Date()))
  useEffect(() => {
    const check = () => setDayKey(toDateInput(new Date()))
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  function openManage(tab: ManageTab) {
    setManageTab(tab)
    setScreen('manage')
  }

  // ----- wins, tasks, time -----

  function logWin(values: WinValues) {
    setData((d) => addLoggedWin(d, values, new Date()))
    setLogging(false)
  }

  const handleAddTask = (values: WinValues) => setData((d) => addTask(d, values, new Date()))
  const handleEditWin = (id: string, values: WinValues) => setData((d) => applyWinEdit(d, id, values))
  const handleDeleteWin = (id: string) => setData((d) => deleteWin(d, id))
  const handleUpdateEntry = (id: string, patch: TimeEntryPatch) => setData((d) => applyEntryEdit(d, id, patch))
  const handleDeleteEntry = (id: string) => setData((d) => deleteEntry(d, id))

  // Finishing or reopening a task offers Undo, which restores it exactly as it was
  // (including its original completion time).
  function setStatus(id: string, status: WinStatus) {
    const previous = data.wins.find((w) => w.id === id)
    if (!previous) return
    const now = new Date()
    setData((d) => ({ ...d, wins: d.wins.map((w) => (w.id === id ? withStatus(w, status, now) : w)) }))
    const message =
      status === 'done' ? `Done: "${previous.title}"` : previous.status === 'done' ? `Reopened "${previous.title}"` : null
    if (message) {
      setToast({
        id: crypto.randomUUID(),
        message,
        undo: () => setData((d) => ({ ...d, wins: d.wins.map((w) => (w.id === id ? previous : w)) })),
      })
    }
  }

  function addSession(winId: string, minutes: number) {
    setData((d) => ({
      ...d,
      timeEntries: [...d.timeEntries, { id: crypto.randomUUID(), at: new Date(), minutes, winId, goalIds: [], areas: [] }],
    }))
  }

  // ----- timer -----

  function beginTimer(start: TimerStart) {
    setToast(null) // an old Undo shouldn't be able to fight with the new timer
    setData((d) => startTimer(d, start, new Date()))
    setStartingTimer(false)
  }

  // Starting a timer on a to-do also marks it as being worked on.
  function beginTimerForTask(task: Win) {
    setToast(null)
    const now = new Date()
    setData((d) => {
      const started = startTimer(d, { title: task.title, winId: task.id, areas: [], goalIds: [] }, now)
      return started === d
        ? d
        : { ...started, wins: started.wins.map((w) => (w.id === task.id && w.status === 'todo' ? withStatus(w, 'doing', now) : w)) }
    })
  }

  function finishTimer(options?: StopOptions) {
    const stopped = data.timer
    const result = stopTimer(data, new Date(), options)
    if (!result.entry || !stopped) return
    const entry = result.entry
    setData(result.data)
    setToast({
      id: entry.id,
      message: `Saved ${formatMinutes(entry.minutes)} to "${stopped.title}"`,
      // Undo removes the saved time and puts the timer back (unless another one has started).
      // If a different timer is running by now, leave the saved time alone rather than lose it.
      undo: () => setData((d) => (d.timer ? d : { ...deleteEntry(d, entry.id), timer: stopped })),
    })
  }

  // ----- goals, areas, quick wins -----

  function saveGoal(goal: GoalDef, backfill: boolean) {
    setData((d) => {
      const exists = d.goals.some((g) => g.id === goal.id)
      const goals = exists ? d.goals.map((g) => (g.id === goal.id ? goal : g)) : [...d.goals, goal]
      const next = { ...d, goals }
      return backfill ? { ...next, ...linkByArea(goal, next) } : next
    })
  }

  function saveArea(area: AreaDef) {
    setData((d) => ({
      ...d,
      areas: d.areas.some((a) => a.id === area.id) ? d.areas.map((a) => (a.id === area.id ? area : a)) : [...d.areas, area],
    }))
  }

  // Bring earlier wins with this name up to date with a changed template. Undo puts back
  // exactly the wins that changed, leaving anything else you did in the meantime alone.
  function applyTemplateToEarlier(template: QuickWin, oldTitle: string, since?: Date) {
    const result = applyTemplateToWins(data, template, oldTitle, since)
    if (result.changedIds.length === 0) {
      setToast({ id: crypto.randomUUID(), message: 'Those wins already had everything.' })
      return
    }
    const before = new Map(data.wins.filter((w) => result.changedIds.includes(w.id)).map((w) => [w.id, w]))
    setData(result.data)
    setToast({
      id: crypto.randomUUID(),
      message: `Updated ${result.changedIds.length} earlier ${result.changedIds.length === 1 ? 'win' : 'wins'} named "${oldTitle}"`,
      // Undo takes back only what this added, keeping anything done to those wins meanwhile.
      undo: () => setData((d) => revertTemplateApplication(d, template, [...before.values()])),
    })
  }

  function saveQuickWin(quickWin: QuickWin) {
    setData((d) => ({
      ...d,
      quickWins: d.quickWins.some((q) => q.id === quickWin.id)
        ? d.quickWins.map((q) => (q.id === quickWin.id ? quickWin : q))
        : [...d.quickWins, quickWin],
    }))
  }

  // One tap logs a win; the confirmation says what it counted toward, with Undo.
  function tapQuickWin(quickWinId: string) {
    // A double-tap on the same chip is one tap, not two wins.
    const tappedAt = Date.now()
    if (lastQuickTap.current.id === quickWinId && tappedAt - lastQuickTap.current.at < 700) return
    lastQuickTap.current = { id: quickWinId, at: tappedAt }
    const now = new Date()
    const result = applyQuickWin(data, quickWinId, now)
    if (!result) return
    setData(result.data)
    const title = data.quickWins.find((q) => q.id === quickWinId)?.title ?? ''
    const lines = contributionsFor(result.data, result.winId, now)
    setToast({
      id: result.winId,
      message: `Logged "${title}"${lines.length > 0 ? ` · ${lines.join(' · ')}` : ''}`,
      undo: () => setData((d) => undoQuickWin(d, result.winId, quickWinId)),
    })
  }

  if (loadError) {
    return (
      <RecoveryScreen
        message={loadError.message}
        raw={loadError.raw}
        onRestore={(restored) => {
          skipNextSave.current = false // this must be saved, whatever happened in other tabs
          setData(restored)
          setLoadError(null)
          setLoaded(true)
        }}
        onStartFresh={() => {
          skipNextSave.current = false
          setData(emptyData)
          setLoadError(null)
          setLoaded(true)
        }}
      />
    )
  }

  if (!loaded) return null

  const nav = (
    <NavBar
      screen={screen}
      onChange={(next) => {
        setToast(null) // an Undo offered on one screen shouldn't resurface on another
        setEditingKey(null)
        setScreen(next)
      }}
    />
  )
  const noticeEl = saveProblem && (
    <div className="notice" role="alert">
      {saveProblem} That change was undone, so what you see matches what is saved on this device. Export a backup under Manage if you'd like a copy.
    </div>
  )
  const toastEl = toast && (
    <Toast
      id={toast.id}
      message={toast.message}
      onUndo={toast.undo ? () => { toast.undo?.(); setToast(null) } : undefined}
      onDismiss={dismissToast}
    />
  )
  const timerRunning = data.timer !== null

  const logHandlers = {
    onEditWin: handleEditWin,
    onDeleteWin: handleDeleteWin,
    onUpdateEntry: handleUpdateEntry,
    onDeleteEntry: handleDeleteEntry,
  }

  if (screen === 'manage') {
    return (
      <Providers data={data}>
        {noticeEl}
        <ManageScreen
          tab={manageTab}
          onTab={setManageTab}
          tasks={{
            wins: data.wins,
            goals: data.goals,
            timeEntries: data.timeEntries,
            quickWins: data.quickWins,
            onSaveQuickWin: saveQuickWin,
            onApplyTemplateToEarlier: applyTemplateToEarlier,
            onRemoveQuickWin: (id) => setData((d) => ({ ...d, quickWins: d.quickWins.filter((q) => q.id !== id) })),
            onAdd: handleAddTask,
            onEdit: handleEditWin,
            onSetStatus: setStatus,
            onDelete: handleDeleteWin,
            onAddSession: addSession,
            timerRunning,
            onStartTimer: beginTimerForTask,
          }}
          goals={{
            goals: data.goals,
            onSave: saveGoal,
            onArchive: (id) => setData((d) => archiveGoal(d, id, new Date())),
            onRestore: (id) => setData((d) => restoreGoal(d, id)),
            onDelete: (id) => setData((d) => removeGoal(d, id)),
          }}
          areas={{ areas: data.areas, onSave: saveArea, onRemove: (id) => setData((d) => removeArea(d, id)) }}
          // A backup replaces your saved history, but never stops a timer that's running right now.
          backup={{ data, onImport: (imported) => setData((d) => ({ ...imported, timer: d.timer })) }}
        />
        {toastEl}
        {nav}
      </Providers>
    )
  }

  if (screen === 'history') {
    return (
      <Providers data={data}>
        {noticeEl}
        <HistoryScreen data={data} {...logHandlers} />
        {toastEl}
        {nav}
      </Providers>
    )
  }

  // Progress is calculated on every render from the saved data, never stored.
  const now = new Date()
  const overallGoals = data.goals.filter((g) => g.childIds && isActive(g))
  const leafGoals = data.goals.filter((g) => !g.childIds && isActive(g))
  const unfinished = data.wins.filter((w) => w.status === 'todo' || w.status === 'doing')
  const todayItems = activityFor(data, dayRange(now))
  // Lets an entry be fixed right in Today's list (or from a bead), without a trip through History.
  const todayEditor: TodayEditor = {
    wins: data.wins,
    timeEntries: data.timeEntries,
    goals: data.goals,
    editingKey,
    setEditingKey,
    onEditWin: handleEditWin,
    onDeleteWin: handleDeleteWin,
    onUpdateEntry: handleUpdateEntry,
    onDeleteEntry: handleDeleteEntry,
  }

  return (
    <Providers data={data}>
      {noticeEl}
      <main className="home">
        <h1>Today</h1>

        {overallGoals.map((goal) => (
          <OverallCard key={goal.id} goal={goal} data={data} now={now} />
        ))}

        {/* The header: goal rings, and under them a bead for every win finished today. */}
        <section className="card header-card">
          {leafGoals.length > 0 ? (
            <div className="rings">
              {leafGoals.map((goal) => (
                <GoalRing key={goal.id} goal={goal} progress={progressFor(goal, data, periodStartFor(goal.period, now))} />
              ))}
            </div>
          ) : (
            <div>
              <p className="muted">Goals show up here as rings you fill as you go.</p>
              <button className="link" onClick={() => openManage('goals')}>
                Add your first goal
              </button>
            </div>
          )}
          <TodayBeads items={todayItems} onEdit={setEditingKey} />
        </section>

        {data.timer && <TimerCard timer={data.timer} onStop={finishTimer} onDiscard={() => setData((d) => discardTimer(d))} />}

        {logging ? (
          <WinForm
            goals={data.goals}
            withMinutes
            withWhen
            onSave={logWin}
            onCancel={() => setLogging(false)}
          />
        ) : startingTimer ? (
          <TimerStarter goals={data.goals} tasks={unfinished} onStart={beginTimer} onCancel={() => setStartingTimer(false)} />
        ) : (
          <>
            <button className="did-something" onClick={() => setLogging(true)}>
              I did something
            </button>
            {!timerRunning && (
              <button className="secondary" onClick={() => setStartingTimer(true)}>
                ▶ Start a timer
              </button>
            )}
            <QuickWinChips quickWins={data.quickWins} onTap={tapQuickWin} onManage={() => openManage('tasks')} />
          </>
        )}

        <TodayWins items={todayItems} editor={todayEditor} />
        <TodoList
          tasks={unfinished}
          goals={data.goals}
          timeEntries={data.timeEntries}
          onComplete={(id) => setStatus(id, 'done')}
          onAdd={handleAddTask}
          onEdit={handleEditWin}
          onAddSession={addSession}
          onSeeAll={() => openManage('tasks')}
          timerRunning={timerRunning}
          onStartTimer={beginTimerForTask}
        />
      </main>
      {toastEl}
      {nav}
    </Providers>
  )
}

export default App
