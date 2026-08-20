import type { DueReminder } from '../types'
import { formatCountdown, ordinal } from './dates'
import { eventLabel } from './occurrences'

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

const EVENT_EMOJI = { birthday: '🎂', anniversary: '💐' } as const

/** iPadOS reports itself as a Mac, so touch points are the giveaway. */
export const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** True once the app has been added to the home screen and launched from there. */
export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const notificationsSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window

export function notificationPermission(): PermissionState {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission as PermissionState
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return (await Notification.requestPermission()) as PermissionState
  } catch {
    return notificationPermission()
  }
}

export function reminderTitle(due: DueReminder): string {
  const { person, type } = due.occurrence
  return `${EVENT_EMOJI[type]} ${person.name}'s ${eventLabel(type).toLowerCase()}`
}

export function reminderBody(due: DueReminder): string {
  const { daysUntil, yearsMarked, type } = due.occurrence
  const when = formatCountdown(daysUntil)
  if (yearsMarked === null) return when
  return type === 'birthday'
    ? `${when} · turning ${yearsMarked}`
    : `${when} · ${ordinal(yearsMarked)} anniversary`
}

/**
 * Shows the system notifications for whatever is due.
 *
 * iOS only allows notifications from a service worker registration, so that
 * path is tried first and a plain `Notification` is the desktop fallback.
 */
export async function presentReminders(dues: DueReminder[]): Promise<void> {
  if (!dues.length || notificationPermission() !== 'granted') return

  let registration: ServiceWorkerRegistration | undefined
  if ('serviceWorker' in navigator) {
    try {
      registration = await navigator.serviceWorker.ready
    } catch {
      registration = undefined
    }
  }

  for (const due of dues) {
    const options: NotificationOptions = {
      body: reminderBody(due),
      tag: due.occurrence.id,
      icon: 'pwa-192x192.png',
      badge: 'pwa-192x192.png',
    }

    try {
      if (registration) {
        await registration.showNotification(reminderTitle(due), options)
      } else {
        new Notification(reminderTitle(due), options)
      }
    } catch (error) {
      console.warn('BD Alert could not show a notification:', error)
    }
  }
}

/** Puts a count on the home-screen icon where the platform supports it. */
export function updateBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }

  try {
    if (count > 0) void nav.setAppBadge?.(count)
    else void nav.clearAppBadge?.()
  } catch {
    /* badging is a nicety, never a failure worth surfacing */
  }
}
