import { useMemo, useState } from 'react'
import { CalendarPlus, Cake, Heart, Trash2 } from 'lucide-react'
import type { Person, Settings } from '../types'
import {
  describeOffset,
  formatFull,
  isLeapYear,
  nextOccurrence,
  ordinal,
  parseDateValue,
  toDateValue,
  yearsMarkedAt,
} from '../lib/dates'
import { REMINDER_CHOICES } from '../lib/storage'
import { calendarFilename, downloadCalendar } from '../lib/ics'
import { Sheet } from './Sheet'

interface PersonSheetProps {
  person: Person
  isNew: boolean
  settings: Settings
  onSave: (person: Person) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const nextLeapYear = (): number => {
  let year = new Date().getFullYear()
  while (!isLeapYear(year)) year++
  return year
}

/** Splits a stored value into something `<input type="date">` can hold. */
function toInputValue(stored: string | null): { input: string; yearUnknown: boolean } {
  const parts = parseDateValue(stored)
  if (!parts) return { input: '', yearUnknown: false }
  if (parts.year !== null) return { input: toDateValue(parts), yearUnknown: false }

  // The date picker needs a real year, so stand one in that can hold the day.
  const year = parts.month === 2 && parts.day === 29 ? nextLeapYear() : new Date().getFullYear()
  return { input: toDateValue({ ...parts, year }), yearUnknown: true }
}

function fromInputValue(input: string, yearUnknown: boolean): string | null {
  const parts = parseDateValue(input)
  if (!parts) return null
  return toDateValue({ ...parts, year: yearUnknown ? null : parts.year })
}

interface DateFieldProps {
  icon: 'cake' | 'heart'
  label: string
  value: string
  yearUnknown: boolean
  unknownLabel: string
  onChange: (value: string) => void
  onYearUnknownChange: (value: boolean) => void
  preview: string | null
}

function DateField({
  icon,
  label,
  value,
  yearUnknown,
  unknownLabel,
  onChange,
  onYearUnknownChange,
  preview,
}: DateFieldProps) {
  return (
    <div>
      <span className="label flex items-center gap-2">
        {icon === 'cake' ? (
          <Cake size={16} className="text-brand-500" />
        ) : (
          <Heart size={16} className="text-violet-500" />
        )}
        {label}
      </span>

      <div className="flex items-center gap-2">
        <input
          type="date"
          className="field"
          value={value}
          max="2999-12-31"
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="btn-ghost px-3 py-3 text-sm"
          >
            Clear
          </button>
        ) : null}
      </div>

      {value ? (
        <label className="mt-2.5 flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
            checked={yearUnknown}
            onChange={(event) => onYearUnknownChange(event.target.checked)}
          />
          {unknownLabel}
        </label>
      ) : null}

      {preview ? <p className="hint mt-2">{preview}</p> : null}
    </div>
  )
}

export function PersonSheet({
  person,
  isNew,
  settings,
  onSave,
  onDelete,
  onClose,
}: PersonSheetProps) {
  const initialBirthday = toInputValue(person.birthday)
  const initialAnniversary = toInputValue(person.anniversary)

  const [name, setName] = useState(person.name)
  const [birthday, setBirthday] = useState(initialBirthday.input)
  const [birthdayYearUnknown, setBirthdayYearUnknown] = useState(initialBirthday.yearUnknown)
  const [anniversary, setAnniversary] = useState(initialAnniversary.input)
  const [anniversaryYearUnknown, setAnniversaryYearUnknown] = useState(
    initialAnniversary.yearUnknown,
  )
  const [notes, setNotes] = useState(person.notes)
  const [customReminders, setCustomReminders] = useState(person.reminderOffsets !== null)
  const [offsets, setOffsets] = useState<number[]>(
    person.reminderOffsets ?? settings.defaultOffsets,
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const draft = useMemo<Person>(
    () => ({
      ...person,
      name: name.trim(),
      birthday: fromInputValue(birthday, birthdayYearUnknown),
      anniversary: fromInputValue(anniversary, anniversaryYearUnknown),
      notes,
      reminderOffsets: customReminders ? [...offsets].sort((a, b) => a - b) : null,
    }),
    [
      person,
      name,
      birthday,
      birthdayYearUnknown,
      anniversary,
      anniversaryYearUnknown,
      notes,
      customReminders,
      offsets,
    ],
  )

  const previewFor = (stored: string | null, kind: 'birthday' | 'anniversary'): string | null => {
    const parts = parseDateValue(stored)
    if (!parts) return null

    const next = nextOccurrence(parts)
    const years = yearsMarkedAt(parts, next)
    const suffix =
      years === null
        ? ''
        : kind === 'birthday'
          ? ` · turning ${years}`
          : ` · ${ordinal(years)} anniversary`
    return `Next: ${formatFull(next)}${suffix}`
  }

  const toggleOffset = (offset: number) => {
    setOffsets((current) =>
      current.includes(offset) ? current.filter((o) => o !== offset) : [...current, offset],
    )
  }

  const hasDate = Boolean(draft.birthday || draft.anniversary)
  const canSave = draft.name.length > 0

  return (
    <Sheet
      title={isNew ? 'Add someone' : draft.name || 'Edit'}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-[2]"
            disabled={!canSave}
            onClick={() => onSave(draft)}
          >
            {isNew ? 'Add' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="person-name">
            Name
          </label>
          <input
            id="person-name"
            className="field"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Who is it?"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <DateField
          icon="cake"
          label="Date of birth"
          value={birthday}
          yearUnknown={birthdayYearUnknown}
          unknownLabel="I don't know the year"
          onChange={setBirthday}
          onYearUnknownChange={setBirthdayYearUnknown}
          preview={previewFor(draft.birthday, 'birthday')}
        />

        <DateField
          icon="heart"
          label="Anniversary"
          value={anniversary}
          yearUnknown={anniversaryYearUnknown}
          unknownLabel="I don't know the year"
          onChange={setAnniversary}
          onYearUnknownChange={setAnniversaryYearUnknown}
          preview={previewFor(draft.anniversary, 'anniversary')}
        />

        <div>
          <label className="label" htmlFor="person-notes">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="person-notes"
            className="field min-h-[72px] resize-y"
            placeholder="Gift ideas, how you know them…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <div className="card p-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Custom reminders
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
              checked={customReminders}
              onChange={(event) => setCustomReminders(event.target.checked)}
            />
          </label>

          {customReminders ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {REMINDER_CHOICES.map((offset) => (
                <button
                  key={offset}
                  type="button"
                  onClick={() => toggleOffset(offset)}
                  className={`chip ${offsets.includes(offset) ? 'chip-active' : ''}`}
                >
                  {describeOffset(offset)}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint mt-2">
              Using your defaults:{' '}
              {[...settings.defaultOffsets]
                .sort((a, b) => b - a)
                .map((offset) => describeOffset(offset).toLowerCase())
                .join(', ') || 'none set'}
              .
            </p>
          )}
        </div>

        {!isNew && hasDate ? (
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => downloadCalendar([draft], settings, calendarFilename(draft.name))}
          >
            <CalendarPlus size={18} />
            Add {draft.name || 'this'} to Calendar
          </button>
        ) : null}

        {!isNew ? (
          confirmingDelete ? (
            <div className="card border-red-200 p-4 dark:border-red-900/60">
              <p className="text-sm font-medium">Delete {draft.name || 'this person'}?</p>
              <p className="hint mt-1">
                This removes them from BD Alert. Events already in your Calendar stay there.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="btn-danger flex-1"
                  onClick={() => onDelete(person.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn-ghost w-full text-red-600 dark:text-red-400"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={18} />
              Delete
            </button>
          )
        ) : null}

        {!hasDate ? (
          <p className="hint">Add a date of birth or an anniversary to start getting reminders.</p>
        ) : null}
      </div>
    </Sheet>
  )
}
