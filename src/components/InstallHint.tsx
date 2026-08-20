import { useState } from 'react'
import { Share, X } from 'lucide-react'
import { isIos, isStandalone } from '../lib/notifications'

const KEY = 'bdalert.tip.install.v1'

/** Shown on iPhone until the app is opened from the Home Screen. */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(KEY) === 'dismissed')

  if (dismissed || !isIos() || isStandalone()) return null

  return (
    <div className="card mb-2 flex items-start gap-3 border-brand-200 bg-brand-50 p-3.5 dark:border-brand-900/60 dark:bg-brand-950/30">
      <span className="mt-0.5 text-brand-600 dark:text-brand-400">
        <Share size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Put BD Alert on your Home Screen</p>
        <p className="hint mt-1">
          Tap the Share button in Safari, then Add to Home Screen. It opens like a normal app and
          works without a connection.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(KEY, 'dismissed')
          setDismissed(true)
        }}
        className="rounded-full p-1.5 text-slate-500 transition active:scale-90"
      >
        <X size={16} />
      </button>
    </div>
  )
}
