/**
 * Reading a CSV export from hip., the birthday app by Celebrate Labs.
 *
 * hip writes one row per event, with the date split across three columns and
 * the year left empty when it is not known:
 *
 *     First Name,Last Name,Group,Day,Month,Year,Event Type
 *     "Jan","van Tongeren",Family,31,8,1945,Birthday
 *     "Ralph","Daals",Friends,24,5,,Birthday
 *     "Ralph","Daals",Friends,27,8,2010,Anniversary
 *
 * BD Alert holds one record per person carrying up to two dates, so rows are
 * merged by name — the two Ralph rows above become one person with a birthday
 * and an anniversary.
 */
import type { EventType } from '../types'
import { UNKNOWN_YEAR, daysInMonth, toDateValue } from './dates'

/** The shape `normalisePerson` takes in; it does the validating from here. */
export interface ImportedPerson {
  id: string
  name: string
  birthday: string | null
  anniversary: string | null
  notes: string
}

export interface HipImport {
  people: ImportedPerson[]
  /** Anything the reader had to change or drop, shown before restoring. */
  notices: string[]
}

/**
 * hip has no concept of an anniversary shared by a couple, so they tend to get
 * typed in as a birthday for a "person" named `Anniversary <couple>`.
 */
const COUPLE_MARKER = 'anniversary'

/** Header names are matched loosely: case, spaces and punctuation all ignored. */
const COLUMNS: Record<string, string[]> = {
  first: ['firstname', 'first', 'givenname', 'name'],
  last: ['lastname', 'last', 'surname', 'familyname'],
  group: ['group', 'category', 'list'],
  day: ['day'],
  month: ['month'],
  year: ['year'],
  type: ['eventtype', 'event', 'type', 'occasion'],
}

const headerKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * A stable id derived from the name (FNV-1a, 64-bit), rather than a random one.
 *
 * BD Alert builds its calendar UIDs out of the person id, so importing a fresh
 * hip export later updates the events already in Apple Calendar instead of
 * adding a second copy of every birthday.
 */
export function stableId(name: string): string {
  let hash = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(name)) {
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return `hip-${hash.toString(16).padStart(16, '0')}`
}

/** Splits CSV text into rows of fields, honouring quotes, escaped quotes and CRLF. */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (quoted) {
      if (char !== '"') field += char
      else if (text[i + 1] === '"') (field += '"'), (i += 1)
      else quoted = false
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') (row.push(field), (field = ''))
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }

  if (field || row.length) (row.push(field), rows.push(row))
  return rows.filter((cells) => cells.some((cell) => cell.trim()))
}

/** `null` when the day/month/year do not describe a real date. */
function dateValue(day: string, month: string, year: string): string | null {
  const parts = {
    day: Number(day.trim()),
    month: Number(month.trim()),
    year: year.trim() ? Number(year.trim()) : UNKNOWN_YEAR,
  }
  if (!Number.isInteger(parts.day) || !Number.isInteger(parts.month)) return null
  if (!Number.isInteger(parts.year) || parts.year < 0 || parts.year > 9999) return null
  if (parts.month < 1 || parts.month > 12) return null

  // An unknown year is measured against a leap year, so 29 February survives.
  const last = daysInMonth(parts.month, parts.year === UNKNOWN_YEAR ? 2024 : parts.year)
  if (parts.day < 1 || parts.day > last) return null

  return toDateValue({
    year: parts.year === UNKNOWN_YEAR ? null : parts.year,
    month: parts.month,
    day: parts.day,
  })
}

export function looksLikeHipCsv(text: string): boolean {
  const [header] = splitCsv(text.slice(0, 4096))
  if (!header) return false
  const keys = header.map(headerKey)
  return (
    COLUMNS.day.some((name) => keys.includes(name)) &&
    COLUMNS.month.some((name) => keys.includes(name)) &&
    COLUMNS.first.some((name) => keys.includes(name))
  )
}

/** Throws with a readable message so the interface can show it verbatim. */
export function parseHipCsv(text: string): HipImport {
  const rows = splitCsv(text)
  const header = rows.shift()
  if (!header) throw new Error('That file is empty.')

  const keys = header.map(headerKey)
  const at = (column: string) => {
    const index = keys.findIndex((key) => COLUMNS[column].includes(key))
    return index === -1 ? null : index
  }
  const columns = {
    first: at('first'),
    last: at('last'),
    group: at('group'),
    day: at('day'),
    month: at('month'),
    year: at('year'),
    type: at('type'),
  }

  if (columns.first === null || columns.day === null || columns.month === null) {
    throw new Error(
      'That does not look like a hip export — the first row should name the First Name, Day and Month columns.',
    )
  }

  const cell = (row: string[], index: number | null) =>
    index === null ? '' : (row[index] ?? '').trim()

  const people = new Map<string, ImportedPerson>()
  const couples: string[] = []
  const conflicts: string[] = []
  let merged = 0
  let skipped = 0

  // A single group across the whole file says nothing worth keeping in a note.
  const groups = new Set(rows.map((row) => cell(row, columns.group)).filter(Boolean))
  const keepGroups = groups.size > 1

  for (const row of rows) {
    const first = cell(row, columns.first)
    const last = cell(row, columns.last)
    const rawType = cell(row, columns.type).toLowerCase()

    let name = `${first} ${last}`.trim()
    // hip has no anniversary column, so `Anniversary <couple>` means one.
    let type: EventType = rawType === 'anniversary' ? 'anniversary' : 'birthday'
    if (first.toLowerCase() === COUPLE_MARKER && last) {
      couples.push(`${first} ${last}`)
      name = last
      type = 'anniversary'
    }

    if (!name) {
      skipped += 1
      continue
    }

    const value = dateValue(
      cell(row, columns.day),
      cell(row, columns.month),
      cell(row, columns.year),
    )
    if (!value) {
      skipped += 1
      continue
    }

    const key = name.toLowerCase()
    let person = people.get(key)
    if (!person) {
      person = { id: stableId(key), name, birthday: null, anniversary: null, notes: '' }
      people.set(key, person)
    } else if (!person[type]) {
      merged += 1
    }

    if (person[type] && person[type] !== value) {
      conflicts.push(name)
      continue
    }
    person[type] = value

    const group = cell(row, columns.group)
    if (keepGroups && group) person.notes = group
  }

  if (!people.size) throw new Error('That hip export contains no dates that could be read.')

  const notices: string[] = []
  if (couples.length) {
    notices.push(
      `Read ${couples.map((entry) => `“${entry}”`).join(' and ')} as ${
        couples.length === 1 ? 'an anniversary' : 'anniversaries'
      }, not as ${couples.length === 1 ? 'a person' : 'people'}.`,
    )
  }
  if (merged) {
    notices.push(
      `Combined ${merged} extra ${merged === 1 ? 'row' : 'rows'} into ${
        merged === 1 ? 'a person' : 'people'
      } already listed, so each person carries both dates.`,
    )
  }
  if (conflicts.length) {
    notices.push(
      `${conflicts.length} ${conflicts.length === 1 ? 'row gave' : 'rows gave'} a second, different date for ${[
        ...new Set(conflicts),
      ].join(', ')} — the first was kept.`,
    )
  }
  if (skipped) {
    notices.push(
      `Skipped ${skipped} ${skipped === 1 ? 'row' : 'rows'} with no name or an unreadable date.`,
    )
  }

  return { people: [...people.values()], notices }
}
