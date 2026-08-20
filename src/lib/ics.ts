import type { EventType, Person, Settings } from '../types'
import {
  describeOffset,
  formatFull,
  isLeapYear,
  occurrenceInYear,
  parseDateValue,
  parseTimeOfDay,
} from './dates'
import { EVENT_TYPES, dateValueFor, effectiveOffsets } from './occurrences'

const CRLF = '\r\n'

const EVENT_EMOJI: Record<EventType, string> = { birthday: '🎂', anniversary: '💐' }

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** Escapes the characters RFC 5545 reserves inside a TEXT value. */
const escapeText = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')

/**
 * Folds a content line to 75 octets as the spec requires, counting UTF-8 bytes
 * rather than characters so an emoji is never cut in half.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const segments: string[] = []
  let current = ''
  let bytes = 0

  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > 75) {
      segments.push(current)
      current = ' '
      bytes = 1
    }
    current += char
    bytes += size
  }
  segments.push(current)

  return segments.join(CRLF)
}

/**
 * An alarm trigger relative to the start of an all-day event.
 *
 * The event starts at local midnight, so a reminder at 09:00 on the day itself
 * is nine hours *after* the start, while one a week before is six days and
 * fifteen hours before it.
 */
function alarmTrigger(offsetDays: number, reminderTime: string): string {
  const { hours, minutes } = parseTimeOfDay(reminderTime)
  const minutesBefore = offsetDays * 1440 - (hours * 60 + minutes)

  const before = minutesBefore > 0
  let remaining = Math.abs(minutesBefore)
  const days = Math.floor(remaining / 1440)
  remaining -= days * 1440
  const durationHours = Math.floor(remaining / 60)
  const durationMinutes = remaining % 60

  let duration = before ? '-P' : 'P'
  if (days) duration += `${days}D`
  if (durationHours || durationMinutes || !days) {
    duration += 'T'
    if (durationHours) duration += `${durationHours}H`
    if (durationMinutes) duration += `${durationMinutes}M`
    if (!durationHours && !durationMinutes) duration += '0S'
  }
  return duration
}

const utcStamp = (date: Date): string =>
  [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('')

/** The nearest year the event can be anchored to, respecting 29 February. */
function anchorYear(knownYear: number | null, isLeapDay: boolean): number {
  if (knownYear !== null) return knownYear
  const thisYear = new Date().getFullYear()
  if (!isLeapDay) return thisYear
  let year = thisYear
  while (!isLeapYear(year)) year++
  return year
}

/** How many events a set of people would add to the calendar. */
export const countCalendarEvents = (people: Person[]): number =>
  people.reduce(
    (total, person) =>
      total + EVENT_TYPES.filter((type) => parseDateValue(dateValueFor(person, type))).length,
    0,
  )

/**
 * Builds an iCalendar file of yearly-recurring events with alarms attached.
 *
 * Handing these to Apple Calendar is what makes reminders arrive when the app
 * is shut: the phone's own calendar owns the schedule from then on.
 */
export function buildCalendar(people: Person[], settings: Settings): string {
  const stamp = utcStamp(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BD Alert//Birthdays and anniversaries//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:BD Alert',
    'X-APPLE-CALENDAR-COLOR:#E11D48',
  ]

  for (const person of people) {
    for (const type of EVENT_TYPES) {
      const parts = parseDateValue(dateValueFor(person, type))
      if (!parts) continue

      const isLeapDay = parts.month === 2 && parts.day === 29
      const year = anchorYear(parts.year, isLeapDay)
      const start = occurrenceInYear(parts, year)
      const label = type === 'birthday' ? 'birthday' : 'anniversary'

      const description: string[] = []
      if (parts.year !== null) {
        description.push(
          type === 'birthday'
            ? `Born ${formatFull(start)}`
            : `Since ${formatFull(start)}`,
        )
      }
      if (person.notes.trim()) description.push(person.notes.trim())
      description.push('Kept in BD Alert')

      lines.push(
        'BEGIN:VEVENT',
        `UID:${person.id}-${type}@bd-alert`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}`,
        // 29 February only exists in leap years, so those events are pinned to
        // the last of the 28th/29th that the year actually has.
        isLeapDay
          ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1'
          : 'RRULE:FREQ=YEARLY',
        `SUMMARY:${escapeText(`${EVENT_EMOJI[type]} ${person.name}'s ${label}`)}`,
        `DESCRIPTION:${escapeText(description.join('\n'))}`,
        'CATEGORIES:BD Alert',
        'TRANSP:TRANSPARENT',
        'X-MICROSOFT-CDO-ALLDAYEVENT:TRUE',
      )

      for (const offset of effectiveOffsets(person, settings)) {
        lines.push(
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `TRIGGER:${alarmTrigger(offset, settings.reminderTime)}`,
          `DESCRIPTION:${escapeText(
            `${person.name}'s ${label} — ${describeOffset(offset).toLowerCase()}`,
          )}`,
          'END:VALARM',
        )
      }

      lines.push('END:VEVENT')
    }
  }

  lines.push('END:VCALENDAR')

  return lines.map(foldLine).join(CRLF) + CRLF
}

/** Hands the calendar file to the browser, which on iOS saves it to Files. */
export function downloadCalendar(people: Person[], settings: Settings, filename: string): void {
  const blob = new Blob([buildCalendar(people, settings)], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** A filename safe on every platform, derived from a person's name. */
export const calendarFilename = (name?: string): string => {
  if (!name) return 'bd-alert.ics'
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `bd-alert-${slug}.ics` : 'bd-alert.ics'
}
