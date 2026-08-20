import { useEffect, useState } from 'react'

/**
 * A clock that ticks every minute, and immediately whenever the app comes back
 * to the foreground — which on a phone is most of the time it matters.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = window.setInterval(tick, intervalMs)

    const onWake = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', tick)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', tick)
    }
  }, [intervalMs])

  return now
}
