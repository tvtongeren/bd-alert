export interface DateParts {
  /** `null` when only the day and month are known. */
  year: number | null
  /** 1-12. */
  month: number
  day: number
}

export const UNKNOWN_YEAR = 0

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

export const isLeapYear = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** Parses the stored `YYYY-MM-DD` form. Returns `null` for anything malformed. */
export function parseDateValue(value: string | null | undefined): DateParts | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(month, year === UNKNOWN_YEAR ? 2024 : year)) return null

  return { year: year === UNKNOWN_YEAR ? null : year, month, day }
}

export const toDateValue = (parts: DateParts): string =>
  `${pad(parts.year ?? UNKNOWN_YEAR, 4)}-${pad(parts.month)}-${pad(parts.day)}`

/** `YYYY-MM-DD` for a local date, without the UTC shift `toISOString` applies. */
export const toIsoDate = (date: Date) =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const daysInMonth = (month: number, year: number) =>
  new Date(year, month, 0).getDate()

/** Local midnight today — every comparison in the app is anchored to this. */
export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Where this day/month lands in a given year.
 *
 * 29 February only exists every fourth year, so in common years the event is
 * observed on the 28th. The calendar export uses the same rule.
 */
export function occurrenceInYear(parts: DateParts, year: number): Date {
  const day = parts.month === 2 && parts.day === 29 && !isLeapYear(year) ? 28 : parts.day
  return new Date(year, parts.month - 1, day)
}

/** The next time this date comes round, today included. */
export function nextOccurrence(parts: DateParts, from: Date = startOfToday()): Date {
  const thisYear = occurrenceInYear(parts, from.getFullYear())
  return thisYear >= from ? thisYear : occurrenceInYear(parts, from.getFullYear() + 1)
}

/** Whole days between two local midnights, immune to daylight-saving shifts. */
export const daysBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / 86_400_000)

/** Age being turned / years being marked, or `null` when the year is unknown. */
export function yearsMarkedAt(parts: DateParts, occurrence: Date): number | null {
  if (parts.year === null) return null
  return occurrence.getFullYear() - parts.year
}

export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

const monthDayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' })
const weekdayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const fullFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export const formatMonthDay = (date: Date) => monthDayFormat.format(date)
export const formatWeekdayShort = (date: Date) => weekdayFormat.format(date)
export const formatFull = (date: Date) => fullFormat.format(date)

/** "Today", "Tomorrow", "in 12 days", "in 3 months". */
export function formatCountdown(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 31) return `in ${days} days`
  const months = Math.round(days / 30.44)
  if (months < 12) return `in ${months} month${months === 1 ? '' : 's'}`
  return 'in a year'
}

/** Compact form for the right-hand side of a list row. */
export function formatCountdownShort(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  if (days < 31) return `${days} days`
  const weeks = Math.round(days / 7)
  if (weeks < 9) return `${weeks} wks`
  const months = Math.round(days / 30.44)
  return `${months} mo`
}

/** Parses `HH:MM` into hours and minutes, falling back to 09:00. */
export function parseTimeOfDay(value: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return { hours: 9, minutes: 0 }
  const hours = Math.min(23, Math.max(0, Number(match[1])))
  const minutes = Math.min(59, Math.max(0, Number(match[2])))
  return { hours, minutes }
}

export function formatTimeOfDay(value: string): string {
  const { hours, minutes } = parseTimeOfDay(value)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, hours, minutes),
  )
}

/** How a reminder offset reads in the interface. */
export function describeOffset(days: number): string {
  if (days === 0) return 'On the day'
  if (days === 1) return '1 day before'
  if (days === 7) return '1 week before'
  if (days === 14) return '2 weeks before'
  if (days === 30) return '1 month before'
  return `${days} days before`
}

export function describeOffsetShort(days: number): string {
  if (days === 0) return 'Same day'
  if (days === 7) return '1 wk'
  if (days === 14) return '2 wks'
  if (days === 30) return '1 mo'
  return `${days}d`
}
