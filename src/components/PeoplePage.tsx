import { useMemo, useState } from 'react'
import { Cake, Heart, Plus, Search, UserPlus } from 'lucide-react'
import type { Person } from '../types'
import { formatMonthDay, occurrenceInYear, parseDateValue } from '../lib/dates'
import { Avatar } from './Avatar'

interface PeoplePageProps {
  people: Person[]
  onSelectPerson: (person: Person) => void
  onAdd: () => void
}

/** "20 August" for a stored date, ignoring the year entirely. */
function dayAndMonth(stored: string | null): string | null {
  const parts = parseDateValue(stored)
  if (!parts) return null
  // Any leap year renders 29 February correctly.
  return formatMonthDay(occurrenceInYear(parts, 2024))
}

function PersonRow({ person, onSelect }: { person: Person; onSelect: () => void }) {
  const birthday = dayAndMonth(person.birthday)
  const anniversary = dayAndMonth(person.anniversary)

  return (
    <button
      type="button"
      onClick={onSelect}
      className="card flex w-full items-center gap-3 p-3 text-left transition active:scale-[0.99]"
    >
      <Avatar person={person} />

      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{person.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
          {birthday ? (
            <span className="flex items-center gap-1">
              <Cake size={13} className="text-brand-500" aria-hidden="true" />
              {birthday}
            </span>
          ) : null}
          {anniversary ? (
            <span className="flex items-center gap-1">
              <Heart size={13} className="text-violet-500" aria-hidden="true" />
              {anniversary}
            </span>
          ) : null}
          {!birthday && !anniversary ? <span className="italic">No dates yet</span> : null}
        </span>
      </span>
    </button>
  )
}

export function PeoplePage({ people, onSelectPerson, onAdd }: PeoplePageProps) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return people
      .filter((person) => !needle || person.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [people, query])

  if (!people.length) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <UserPlus size={36} />
        </span>
        <h2 className="mt-5 text-xl font-bold">Nobody here yet</h2>
        <p className="hint mt-2 max-w-xs">
          Everyone you add shows up here, with their dates alongside.
        </p>
        <button type="button" className="btn-primary mt-6 px-6" onClick={onAdd}>
          <Plus size={18} />
          Add someone
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          className="field pl-11"
          placeholder="Search people"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {visible.length ? (
        <div className="space-y-2">
          {visible.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              onSelect={() => onSelectPerson(person)}
            />
          ))}
        </div>
      ) : (
        <p className="hint py-10 text-center">No one matches “{query.trim()}”.</p>
      )}

      <p className="hint pt-2 text-center">
        {people.length} {people.length === 1 ? 'person' : 'people'}
      </p>
    </div>
  )
}
