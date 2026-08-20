import type { BackupBundle, Person, Settings } from '../types'

const PEOPLE_KEY = 'bdalert.people.v1'
const SETTINGS_KEY = 'bdalert.settings.v1'
const ACK_KEY = 'bdalert.acknowledged.v1'

export const DEFAULT_SETTINGS: Settings = {
  reminderTime: '09:00',
  defaultOffsets: [0, 7],
  notificationsEnabled: false,
  theme: 'system',
}

/** The reminder offsets offered in the interface, in days before the event. */
export const REMINDER_CHOICES = [0, 1, 3, 7, 14, 30]

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    // Private browsing or a full quota — the app keeps working in memory.
    console.warn('BD Alert could not save to this device:', error)
  }
}

const isDateValue = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** Trusts nothing: used for stored data and for imported backup files alike. */
export function normalisePerson(raw: unknown): Person | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (!name) return null

  const offsets = Array.isArray(value.reminderOffsets)
    ? value.reminderOffsets.filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 365)
    : null

  const now = new Date().toISOString()
  return {
    id: typeof value.id === 'string' && value.id ? value.id : newId(),
    name,
    birthday: isDateValue(value.birthday) ? value.birthday : null,
    anniversary: isDateValue(value.anniversary) ? value.anniversary : null,
    notes: typeof value.notes === 'string' ? value.notes : '',
    reminderOffsets: offsets,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
  }
}

export function normaliseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS }
  const value = raw as Record<string, unknown>

  const offsets = Array.isArray(value.defaultOffsets)
    ? value.defaultOffsets.filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 365)
    : null

  return {
    reminderTime:
      typeof value.reminderTime === 'string' && /^\d{1,2}:\d{2}$/.test(value.reminderTime)
        ? value.reminderTime
        : DEFAULT_SETTINGS.reminderTime,
    defaultOffsets: offsets && offsets.length ? offsets : [...DEFAULT_SETTINGS.defaultOffsets],
    notificationsEnabled: value.notificationsEnabled === true,
    theme:
      value.theme === 'light' || value.theme === 'dark' || value.theme === 'system'
        ? value.theme
        : 'system',
  }
}

export function loadPeople(): Person[] {
  const raw = readJson<unknown[]>(PEOPLE_KEY, [])
  if (!Array.isArray(raw)) return []
  return raw.map(normalisePerson).filter((p): p is Person => p !== null)
}

export const savePeople = (people: Person[]) => writeJson(PEOPLE_KEY, people)

export const loadSettings = (): Settings => normaliseSettings(readJson<unknown>(SETTINGS_KEY, null))

export const saveSettings = (settings: Settings) => writeJson(SETTINGS_KEY, settings)

export function loadAcknowledged(): Set<string> {
  const raw = readJson<unknown[]>(ACK_KEY, [])
  if (!Array.isArray(raw)) return new Set()
  return new Set(raw.filter((k): k is string => typeof k === 'string'))
}

/**
 * Reminder keys carry the year they belong to, so anything from a past year can
 * never match again and is dropped rather than accumulating forever.
 */
export function saveAcknowledged(keys: Set<string>): void {
  const currentYear = new Date().getFullYear()
  const kept = [...keys].filter((key) => {
    const year = Number(key.split('|')[2]?.slice(0, 4))
    return Number.isFinite(year) && year >= currentYear
  })
  writeJson(ACK_KEY, kept)
}

export function blankPerson(): Person {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: '',
    birthday: null,
    anniversary: null,
    notes: '',
    reminderOffsets: null,
    createdAt: now,
    updatedAt: now,
  }
}

export const makeBackup = (people: Person[], settings: Settings): BackupBundle => ({
  app: 'bd-alert',
  version: 1,
  exportedAt: new Date().toISOString(),
  people,
  settings,
})

export interface ParsedBackup {
  people: Person[]
  settings: Settings | null
}

/** Throws with a readable message so the interface can show it verbatim. */
export function parseBackup(text: string): ParsedBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  // Accept both a full backup bundle and a bare array of people.
  const rawPeople = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown> | null)?.people

  if (!Array.isArray(rawPeople)) {
    throw new Error('That file does not look like a BD Alert backup.')
  }

  const people = rawPeople.map(normalisePerson).filter((p): p is Person => p !== null)
  if (!people.length) throw new Error('That backup contains no people.')

  const rawSettings = Array.isArray(parsed)
    ? null
    : (parsed as Record<string, unknown>).settings ?? null

  return { people, settings: rawSettings ? normaliseSettings(rawSettings) : null }
}

export function clearAll(): void {
  for (const key of [PEOPLE_KEY, SETTINGS_KEY, ACK_KEY]) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* nothing useful to do */
    }
  }
}
