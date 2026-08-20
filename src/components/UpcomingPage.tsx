import { useState } from 'react'
import { BellRing, CalendarCheck, Cake, Plus, X } from 'lucide-react'
import type { DueReminder, Occurrence, Person } from '../types'
import { formatCountdown } from '../lib/dates'
import { upcomingOccurrences } from '../lib/occurrences'
import { EventRow, describeOccurrence } from './EventRow'
import { Avatar } from './Avatar'

const TIP_KEY = 'bdalert.tip.calendar.v1'

interface UpcomingPageProps {
  people: Person[]
  due: DueReminder[]
  now: Date
  onAcknowledge: (keys: string[]) => void
  onSelectPerson: (person: Person) => void
  onAdd: () => void
  onOpenSettings: () => void
}

interface Group {
  title: string
  events: Occurrence[]
}

function groupEvents(events: Occurrence[]): Group[] {
  const groups: Group[] = [
    { title: 'Today', events: [] },
    { title: 'Next 7 days', events: [] },
    { title: 'This month', events: [] },
    { title: 'Later', events: [] },
  ]

  for (const event of events) {
    if (event.daysUntil === 0) groups[0].events.push(event)
    else if (event.daysUntil <= 7) groups[1].events.push(event)
    else if (event.daysUntil <= 31) groups[2].events.push(event)
    else groups[3].events.push(event)
  }

  return groups.filter((group) => group.events.length > 0)
}

function DueCard({ due, onAcknowledge }: { due: DueReminder; onAcknowledge: () => void }) {
  const { occurrence } = due

  return (
    <div className="card border-brand-200 bg-brand-50 p-3.5 dark:border-brand-900/60 dark:bg-brand-950/30">
      <div className="flex items-center gap-3">
        <Avatar person={occurrence.person} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {occurrence.person.name} · {formatCountdown(occurrence.daysUntil).toLowerCase()}
          </p>
          <p className="truncate text-sm text-slate-600 dark:text-slate-400">
            {describeOccurrence(occurrence)}
          </p>
        </div>
        <button
          type="button"
          onClick={onAcknowledge}
          aria-label="Dismiss reminder"
          className="rounded-full p-2 text-slate-500 transition active:scale-90 hover:bg-white/70 dark:hover:bg-slate-800"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

export function UpcomingPage({
  people,
  due,
  now,
  onAcknowledge,
  onSelectPerson,
  onAdd,
  onOpenSettings,
}: UpcomingPageProps) {
  const [tipDismissed, setTipDismissed] = useState(
    () => localStorage.getItem(TIP_KEY) === 'dismissed',
  )

  const events = upcomingOccurrences(people, new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const groups = groupEvents(events)

  const dismissTip = () => {
    localStorage.setItem(TIP_KEY, 'dismissed')
    setTipDismissed(true)
  }

  if (!people.length) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <Cake size={36} />
        </span>
        <h2 className="mt-5 text-xl font-bold">No dates yet</h2>
        <p className="hint mt-2 max-w-xs">
          Add the people whose birthdays and anniversaries you never want to miss.
        </p>
        <button type="button" className="btn-primary mt-6 px-6" onClick={onAdd}>
          <Plus size={18} />
          Add someone
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {due.length ? (
        <section className="space-y-2 pb-2">
          <h2 className="section-title flex items-center gap-1.5 pt-0 text-brand-600 dark:text-brand-400">
            <BellRing size={13} />
            Coming up
          </h2>
          {due.map((item) => (
            <DueCard
              key={item.occurrence.id}
              due={item}
              onAcknowledge={() => onAcknowledge(item.keys)}
            />
          ))}
        </section>
      ) : null}

      {!tipDismissed ? (
        <div className="card flex items-start gap-3 p-3.5">
          <span className="mt-0.5 text-brand-600 dark:text-brand-400">
            <CalendarCheck size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Want alerts when the app is closed?</p>
            <p className="hint mt-1">
              Send your dates to Apple Calendar once, and your phone handles the reminders from
              then on.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={onOpenSettings}>
                Set it up
              </button>
              <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={dismissTip}>
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!events.length ? (
        <p className="hint px-1 py-6 text-center">
          Nobody here has a date yet. Open someone and add their birthday or anniversary.
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="section-title">{group.title}</h2>
          <div className="space-y-2">
            {group.events.map((event) => (
              <EventRow
                key={event.id}
                occurrence={event}
                onSelect={() => onSelectPerson(event.person)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
