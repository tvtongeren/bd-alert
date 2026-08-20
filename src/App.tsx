import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Person } from './types'
import { formatFull } from './lib/dates'
import { dueReminders } from './lib/occurrences'
import { blankPerson } from './lib/storage'
import { presentReminders, updateBadge } from './lib/notifications'
import { useNow } from './hooks/useNow'
import { useStore } from './hooks/useStore'
import { useTheme } from './hooks/useTheme'
import { BottomNav, type Tab } from './components/BottomNav'
import { InstallHint } from './components/InstallHint'
import { PeoplePage } from './components/PeoplePage'
import { PersonSheet } from './components/PersonSheet'
import { SettingsPage } from './components/SettingsPage'
import { UpcomingPage } from './components/UpcomingPage'

const TITLES: Record<Tab, string> = {
  upcoming: 'Upcoming',
  people: 'People',
  settings: 'Settings',
}

export default function App() {
  const store = useStore()
  const now = useNow()
  useTheme(store.settings.theme)

  const [tab, setTab] = useState<Tab>('upcoming')
  const [editing, setEditing] = useState<{ person: Person; isNew: boolean } | null>(null)

  const due = useMemo(
    () => dueReminders(store.people, store.settings, store.acknowledged, now),
    [store.people, store.settings, store.acknowledged, now],
  )

  // One system notification per event per session — the in-app list stays as
  // the running record, so re-notifying on every tick would only be noise.
  const alreadyShown = useRef(new Set<string>())
  useEffect(() => {
    if (!store.settings.notificationsEnabled) return

    const unseen = due.filter((item) => !alreadyShown.current.has(item.occurrence.id))
    if (!unseen.length) return

    for (const item of unseen) alreadyShown.current.add(item.occurrence.id)
    void presentReminders(unseen)
  }, [due, store.settings.notificationsEnabled])

  useEffect(() => {
    updateBadge(due.length)
  }, [due.length])

  const startAdding = () => setEditing({ person: blankPerson(), isNew: true })
  const showFab = tab !== 'settings' && store.people.length > 0

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <header className="sticky top-0 z-20 border-b border-transparent bg-slate-50/85 px-4 pb-3 pt-safe backdrop-blur-xl dark:bg-slate-950/85">
        <h1 className="text-3xl font-bold tracking-tight">{TITLES[tab]}</h1>
        {tab === 'upcoming' ? <p className="hint mt-0.5">{formatFull(now)}</p> : null}
      </header>

      <main className="flex-1 px-4 pb-nav pt-1">
        {tab === 'upcoming' ? (
          <>
            <InstallHint />
            <UpcomingPage
              people={store.people}
              due={due}
              now={now}
              onAcknowledge={store.acknowledge}
              onSelectPerson={(person) => setEditing({ person, isNew: false })}
              onAdd={startAdding}
              onOpenSettings={() => setTab('settings')}
            />
          </>
        ) : null}

        {tab === 'people' ? (
          <PeoplePage
            people={store.people}
            onSelectPerson={(person) => setEditing({ person, isNew: false })}
            onAdd={startAdding}
          />
        ) : null}

        {tab === 'settings' ? (
          <SettingsPage
            people={store.people}
            settings={store.settings}
            onUpdateSettings={store.updateSettings}
            onReplaceAll={store.replaceAll}
            onReset={store.reset}
          />
        ) : null}
      </main>

      {showFab ? (
        <button
          type="button"
          onClick={startAdding}
          aria-label="Add someone"
          className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition active:scale-95"
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus size={26} />
        </button>
      ) : null}

      <BottomNav active={tab} badge={due.length} onChange={setTab} />

      {editing ? (
        <PersonSheet
          key={editing.person.id}
          person={editing.person}
          isNew={editing.isNew}
          settings={store.settings}
          onSave={(person) => {
            store.savePerson(person)
            setEditing(null)
          }}
          onDelete={(id) => {
            store.removePerson(id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}
