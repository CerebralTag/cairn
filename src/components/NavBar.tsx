export type Screen = 'today' | 'history' | 'manage'

const ITEMS: { id: Screen; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
  { id: 'manage', label: 'Manage' },
]

export function NavBar({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  return (
    <nav className="navbar">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          className={screen === item.id ? 'active' : ''}
          aria-current={screen === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
