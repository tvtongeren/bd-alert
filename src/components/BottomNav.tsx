import { CalendarDays, Settings as SettingsIcon, Users } from 'lucide-react'

export type Tab = 'upcoming' | 'people' | 'settings'

const TABS = [
  { id: 'upcoming' as const, label: 'Upcoming', Icon: CalendarDays },
  { id: 'people' as const, label: 'People', Icon: Users },
  { id: 'settings' as const, label: 'Settings', Icon: SettingsIcon },
]

interface BottomNavProps {
  active: Tab
  badge: number
  onChange: (tab: Tab) => void
}

export function BottomNav({ active, badge, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/85 pb-safe backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
      <ul className="mx-auto flex max-w-lg">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-1 py-2 transition ${
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.9} />
                  {id === 'upcoming' && badge > 0 ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
