import { AreasPanel } from './AreasPanel'
import { BackupPanel } from './BackupPanel'
import { GoalsPanel } from './GoalsPanel'
import { TasksPanel } from './TasksPanel'
import { VersionCard } from './VersionCard'

export type ManageTab = 'tasks' | 'goals' | 'areas' | 'backup'

const TABS: { id: ManageTab; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'goals', label: 'Goals' },
  { id: 'areas', label: 'Areas' },
  { id: 'backup', label: 'Backup' },
]

type Props = {
  tab: ManageTab
  onTab: (tab: ManageTab) => void
  tasks: React.ComponentProps<typeof TasksPanel>
  goals: React.ComponentProps<typeof GoalsPanel>
  areas: React.ComponentProps<typeof AreasPanel>
  backup: React.ComponentProps<typeof BackupPanel>
}

// One bottom tab for everything you set up. Tasks, goals and areas sit behind a
// segmented control so the bottom bar stays at three items on a phone.
export function ManageScreen({ tab, onTab, tasks, goals, areas, backup }: Props) {
  return (
    <main className="home">
      <h1>Manage</h1>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tasks' && <TasksPanel {...tasks} />}
      {tab === 'goals' && <GoalsPanel {...goals} />}
      {tab === 'areas' && <AreasPanel {...areas} />}
      {tab === 'backup' && <BackupPanel {...backup} />}

      <VersionCard />
    </main>
  )
}
