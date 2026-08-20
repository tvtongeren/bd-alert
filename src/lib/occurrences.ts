import type { DueReminder, EventType, Occurrence, Person, Settings } from '../types'
import {
  daysBetween,
  nextOccurrence,
  parseDateValue,
  parseTimeOfDay,
  startOfToday,
  toIsoDate,
  yearsMarkedAt,
} from './dates'

export const EVENT_TYPES: EventType[] = ['birthday', 'anniversary']

export const dateValueFor = (person: Person, type: EventType): string | null =>
  type === 'birthday' ? person.birthday : person.anniversary

export const eventLabel = (type: EventType): string =>
  type === 'birthday' ? 'Birthday' : 'Anniversary'

/** Every dated event this person has, resolved to its next occurrence. */
export function occurrencesFor(person: Person, from: Date = startOfToday()): Occurrence[] {
  const result: Occurrence[] = []

  for (const type of EVENT_TYPES) {
    const parts = parseDateValue(dateValueFor(person, type))
    if (!parts) continue

    const date = nextOccurrence(parts, from)
    result.push({
      id: `${person.id}|${type}|${toIsoDate(date)}`,
      person,
      type,
      date,
      daysUntil: daysBetween(from, date),
      yearsMarked: yearsMarkedAt(parts, date),
    })
  }

  return result
}

/** Everyone's events, soonest first, ties broken by name so the order is stable. */
export function upcomingOccurrences(people: Person[], from: Date = startOfToday()): Occurrence[] {
  return people
    .flatMap((person) => occurrencesFor(person, from))
    .sort(
      (a, b) =>
        a.daysUntil - b.daysUntil ||
        a.person.name.localeCompare(b.person.name) ||
        a.type.localeCompare(b.type),
    )
}

export const effectiveOffsets = (person: Person, settings: Settings): number[] =>
  [...(person.reminderOffsets ?? settings.defaultOffsets)].sort((a, b) => b - a)

export const reminderKey = (occurrence: Occurrence, offset: number): string =>
  `${occurrence.person.id}|${occurrence.type}|${toIsoDate(occurrence.date)}|${offset}`

/** The exact moment a given reminder is meant to land. */
export function reminderInstant(occurrence: Occurrence, offset: number, settings: Settings): Date {
  const { hours, minutes } = parseTimeOfDay(settings.reminderTime)
  const instant = new Date(occurrence.date)
  instant.setDate(instant.getDate() - offset)
  instant.setHours(hours, minutes, 0, 0)
  return instant
}

/**
 * Reminders that have come due but have not been acknowledged yet.
 *
 * iOS will not wake a web app to fire an alert on its own, so BD Alert catches
 * up instead: whatever became due while the app was closed is surfaced the next
 * time it is opened. A single event yields at most one entry even when several
 * of its reminders elapsed unseen, and acknowledging it clears all of them.
 */
export function dueReminders(
  people: Person[],
  settings: Settings,
  acknowledged: Set<string>,
  now: Date = new Date(),
): DueReminder[] {
  const today = startOfToday(now)
  const due: DueReminder[] = []

  for (const occurrence of upcomingOccurrences(people, today)) {
    const keys = effectiveOffsets(occurrence.person, settings)
      .filter((offset) => reminderInstant(occurrence, offset, settings) <= now)
      .map((offset) => reminderKey(occurrence, offset))

    const unseen = keys.filter((key) => !acknowledged.has(key))
    if (unseen.length) due.push({ occurrence, keys })
  }

  return due
}

/** Initials for the avatar, at most two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** A stable colour per person, so the same face keeps the same badge. */
export function avatarHue(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360
  return hash
}
