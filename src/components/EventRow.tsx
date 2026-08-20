import { Cake, Heart } from 'lucide-react'
import type { Occurrence } from '../types'
import { formatCountdownShort, formatWeekdayShort, ordinal } from '../lib/dates'
import { Avatar } from './Avatar'

interface EventRowProps {
  occurrence: Occurrence
  onSelect: () => void
}

/** What the event is about, under the name: "Birthday · turning 34". */
export function describeOccurrence(occurrence: Occurrence): string {
  const { type, yearsMarked } = occurrence
  const label = type === 'birthday' ? 'Birthday' : 'Anniversary'
  if (yearsMarked === null) return label
  return type === 'birthday'
    ? `${label} · turning ${yearsMarked}`
    : `${label} · ${ordinal(yearsMarked)} year`
}

export function EventRow({ occurrence, onSelect }: EventRowProps) {
  const today = occurrence.daysUntil === 0
  const Icon = occurrence.type === 'birthday' ? Cake : Heart

  return (
    <button
      type="button"
      onClick={onSelect}
      className="card flex w-full items-center gap-3 p-3 text-left transition active:scale-[0.99]"
    >
      <Avatar person={occurrence.person} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{occurrence.person.name}</span>
          <Icon
            size={14}
            className={occurrence.type === 'birthday' ? 'text-brand-500' : 'text-violet-500'}
            aria-hidden="true"
          />
        </span>
        <span className="mt-0.5 block truncate text-sm text-slate-500 dark:text-slate-400">
          {describeOccurrence(occurrence)}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={`block text-sm font-bold ${
            today ? 'text-brand-600 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {formatCountdownShort(occurrence.daysUntil)}
        </span>
        <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">
          {formatWeekdayShort(occurrence.date)}
        </span>
      </span>
    </button>
  )
}
