export type EventType = 'birthday' | 'anniversary'

export interface Person {
  id: string
  name: string
  /**
   * Stored as `YYYY-MM-DD`. A year of `0000` means "day and month known, year
   * not" — common for people whose birthday you know but whose age you don't.
   */
  birthday: string | null
  anniversary: string | null
  notes: string
  /** `null` follows the global default offsets from settings. */
  reminderOffsets: number[] | null
  createdAt: string
  updatedAt: string
}

export interface Settings {
  /** Local time of day reminders are timed for, as `HH:MM`. */
  reminderTime: string
  /** Days before the event to be reminded, e.g. `[0, 7]`. */
  defaultOffsets: number[]
  notificationsEnabled: boolean
  theme: 'system' | 'light' | 'dark'
}

/** One dated event resolved onto the calendar. */
export interface Occurrence {
  id: string
  person: Person
  type: EventType
  /** Local midnight of the next time this event comes round. */
  date: Date
  daysUntil: number
  /** Age being turned, or years being marked. `null` when the year is unknown. */
  yearsMarked: number | null
}

export interface DueReminder {
  occurrence: Occurrence
  /** Every reminder key covered, so acknowledging clears them all at once. */
  keys: string[]
}

export interface BackupBundle {
  app: 'bd-alert'
  version: 1
  exportedAt: string
  people: Person[]
  settings: Settings
}
