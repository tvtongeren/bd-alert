import { useRef, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CalendarPlus,
  Check,
  Download,
  Info,
  Trash2,
  Upload,
} from 'lucide-react'
import type { Person, Settings } from '../types'
import { describeOffset, formatTimeOfDay } from '../lib/dates'
import { REMINDER_CHOICES, makeBackup, parseBackup } from '../lib/storage'
import { calendarFilename, countCalendarEvents, downloadCalendar } from '../lib/ics'
import {
  isIos,
  isStandalone,
  notificationPermission,
  requestNotificationPermission,
} from '../lib/notifications'

interface SettingsPageProps {
  people: Person[]
  settings: Settings
  onUpdateSettings: (patch: Partial<Settings>) => void
  onReplaceAll: (people: Person[], settings?: Settings | null) => void
  onReset: () => void
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="section-title flex items-center gap-1.5">
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
        {title}
      </h2>
      <div className="card space-y-4 p-4">{children}</div>
    </section>
  )
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function NotificationsCard({
  settings,
  onUpdateSettings,
}: Pick<SettingsPageProps, 'settings' | 'onUpdateSettings'>) {
  const [permission, setPermission] = useState(notificationPermission)
  const needsInstall = isIos() && !isStandalone()

  const enable = async () => {
    const result = await requestNotificationPermission()
    setPermission(result)
    onUpdateSettings({ notificationsEnabled: result === 'granted' })
  }

  return (
    <>
      <p className="hint">
        BD Alert can show a notification for anything that has come due — but only while it is
        open, because iOS does not let a web app wake itself up in the background.{' '}
        <strong className="font-semibold text-slate-700 dark:text-slate-300">
          For alerts that reach you with the app closed, use Calendar above.
        </strong>
      </p>

      {needsInstall ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Add BD Alert to your Home Screen first — iPhone only allows notifications from an
          installed web app.
        </p>
      ) : permission === 'unsupported' ? (
        <p className="hint">This browser does not support notifications.</p>
      ) : permission === 'granted' ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <Check size={16} />
          Notifications are on for this device.
        </p>
      ) : permission === 'denied' ? (
        <p className="hint">
          Notifications are blocked. Turn them back on in iPhone Settings → Notifications → BD
          Alert.
        </p>
      ) : (
        <button type="button" className="btn-secondary w-full" onClick={enable}>
          <BellRing size={18} />
          Turn on notifications
        </button>
      )}

      {permission === 'granted' && !settings.notificationsEnabled ? (
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => onUpdateSettings({ notificationsEnabled: true })}
        >
          Use notifications in BD Alert
        </button>
      ) : null}
    </>
  )
}

function DataCard({
  people,
  settings,
  onReplaceAll,
  onReset,
}: Omit<SettingsPageProps, 'onUpdateSettings'>) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ people: Person[]; settings: Settings | null } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const onFile = async (file: File) => {
    setError(null)
    try {
      setPending(parseBackup(await file.text()))
    } catch (problem) {
      setPending(null)
      setError(problem instanceof Error ? problem.message : 'That file could not be read.')
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-secondary w-full"
        disabled={!people.length}
        onClick={() =>
          downloadJson(
            makeBackup(people, settings),
            `bd-alert-backup-${new Date().toISOString().slice(0, 10)}.json`,
          )
        }
      >
        <Download size={18} />
        Export a backup
      </button>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onFile(file)
          event.target.value = ''
        }}
      />
      <button type="button" className="btn-secondary w-full" onClick={() => fileInput.current?.click()}>
        <Upload size={18} />
        Restore from a backup
      </button>

      {error ? (
        <p className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {pending ? (
        <div className="card border-brand-200 p-3.5 dark:border-brand-900/60">
          <p className="text-sm font-medium">
            Restore {pending.people.length}{' '}
            {pending.people.length === 1 ? 'person' : 'people'}?
          </p>
          <p className="hint mt-1">This replaces everyone currently in BD Alert.</p>
          <div className="mt-3 flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                onReplaceAll(pending.people, pending.settings)
                setPending(null)
              }}
            >
              Restore
            </button>
          </div>
        </div>
      ) : null}

      {confirmingReset ? (
        <div className="card border-red-200 p-3.5 dark:border-red-900/60">
          <p className="text-sm font-medium">Delete everyone?</p>
          <p className="hint mt-1">
            This clears BD Alert on this device. Events already in your Calendar stay there.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setConfirmingReset(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger flex-1"
              onClick={() => {
                onReset()
                setConfirmingReset(false)
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn-ghost w-full text-red-600 dark:text-red-400"
          disabled={!people.length}
          onClick={() => setConfirmingReset(true)}
        >
          <Trash2 size={18} />
          Delete everything
        </button>
      )}
    </>
  )
}

export function SettingsPage({
  people,
  settings,
  onUpdateSettings,
  onReplaceAll,
  onReset,
}: SettingsPageProps) {
  const eventCount = countCalendarEvents(people)

  const toggleDefaultOffset = (offset: number) => {
    const next = settings.defaultOffsets.includes(offset)
      ? settings.defaultOffsets.filter((o) => o !== offset)
      : [...settings.defaultOffsets, offset]
    onUpdateSettings({ defaultOffsets: next.sort((a, b) => a - b) })
  }

  return (
    <div className="space-y-1 pb-4">
      <Section title="Reminders" icon={<BellRing size={13} />}>
        <div>
          <label className="label" htmlFor="reminder-time">
            Remind me at
          </label>
          <input
            id="reminder-time"
            type="time"
            className="field"
            value={settings.reminderTime}
            onChange={(event) => onUpdateSettings({ reminderTime: event.target.value })}
          />
          <p className="hint mt-1.5">Alerts are timed for {formatTimeOfDay(settings.reminderTime)}.</p>
        </div>

        <div>
          <span className="label">How far ahead</span>
          <div className="flex flex-wrap gap-2">
            {REMINDER_CHOICES.map((offset) => (
              <button
                key={offset}
                type="button"
                onClick={() => toggleDefaultOffset(offset)}
                className={`chip ${settings.defaultOffsets.includes(offset) ? 'chip-active' : ''}`}
              >
                {describeOffset(offset)}
              </button>
            ))}
          </div>
          <p className="hint mt-2">
            Used for everyone, unless you give a person their own reminders.
          </p>
        </div>
      </Section>

      <Section title="Apple Calendar" icon={<CalendarPlus size={13} />}>
        <p className="hint">
          This is what makes reminders arrive when BD Alert is closed. Every date becomes a yearly
          event in your own Calendar, with the alerts above attached.
        </p>

        <button
          type="button"
          className="btn-primary w-full"
          disabled={!eventCount}
          onClick={() => downloadCalendar(people, settings, calendarFilename())}
        >
          <CalendarPlus size={18} />
          {eventCount
            ? `Add ${eventCount} ${eventCount === 1 ? 'date' : 'dates'} to Calendar`
            : 'No dates to add yet'}
        </button>

        <ol className="hint list-decimal space-y-1 pl-5">
          <li>Tap the button — iPhone saves a file called bd-alert.ics.</li>
          <li>Open it from the Files app (or the download bar in Safari).</li>
          <li>Choose Add All, and pick the calendar to put them in.</li>
        </ol>

        <p className="hint">
          Do this again after adding people or changing reminder times — importing the same dates
          twice updates them rather than duplicating them.
        </p>
      </Section>

      <Section title="Notifications" icon={<BellRing size={13} />}>
        <NotificationsCard settings={settings} onUpdateSettings={onUpdateSettings} />
      </Section>

      <Section title="Appearance" icon={<Info size={13} />}>
        <div className="flex gap-2">
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => onUpdateSettings({ theme })}
              className={`chip flex-1 capitalize ${settings.theme === theme ? 'chip-active' : ''}`}
            >
              {theme}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Your data" icon={<Download size={13} />}>
        <p className="hint">
          Everything you enter stays on this device. Nothing is uploaded, and there is no account —
          so keep a backup if this phone is the only copy.
        </p>
        <DataCard
          people={people}
          settings={settings}
          onReplaceAll={onReplaceAll}
          onReset={onReset}
        />
      </Section>

      <p className="hint px-1 pt-6 text-center text-xs">BD Alert · works offline · v1.0</p>
    </div>
  )
}
