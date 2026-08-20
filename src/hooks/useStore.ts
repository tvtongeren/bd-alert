import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Person, Settings } from '../types'
import {
  loadAcknowledged,
  loadPeople,
  loadSettings,
  saveAcknowledged,
  savePeople,
  saveSettings,
} from '../lib/storage'

export interface Store {
  people: Person[]
  settings: Settings
  acknowledged: Set<string>
  savePerson: (person: Person) => void
  removePerson: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  acknowledge: (keys: string[]) => void
  replaceAll: (people: Person[], settings?: Settings | null) => void
  reset: () => void
}

/** Everything the app knows, held in memory and mirrored to this device. */
export function useStore(): Store {
  const [people, setPeople] = useState<Person[]>(loadPeople)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [acknowledged, setAcknowledged] = useState<Set<string>>(loadAcknowledged)

  useEffect(() => savePeople(people), [people])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveAcknowledged(acknowledged), [acknowledged])

  const savePerson = useCallback((person: Person) => {
    const stamped = { ...person, name: person.name.trim(), updatedAt: new Date().toISOString() }
    setPeople((current) => {
      const index = current.findIndex((p) => p.id === stamped.id)
      if (index === -1) return [...current, stamped]
      const next = [...current]
      next[index] = stamped
      return next
    })
  }, [])

  const removePerson = useCallback((id: string) => {
    setPeople((current) => current.filter((person) => person.id !== id))
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  const acknowledge = useCallback((keys: string[]) => {
    setAcknowledged((current) => {
      const next = new Set(current)
      for (const key of keys) next.add(key)
      return next
    })
  }, [])

  const replaceAll = useCallback((incoming: Person[], incomingSettings?: Settings | null) => {
    setPeople(incoming)
    if (incomingSettings) setSettings(incomingSettings)
    setAcknowledged(new Set())
  }, [])

  const reset = useCallback(() => {
    setPeople([])
    setAcknowledged(new Set())
  }, [])

  return useMemo(
    () => ({
      people,
      settings,
      acknowledged,
      savePerson,
      removePerson,
      updateSettings,
      acknowledge,
      replaceAll,
      reset,
    }),
    [
      people,
      settings,
      acknowledged,
      savePerson,
      removePerson,
      updateSettings,
      acknowledge,
      replaceAll,
      reset,
    ],
  )
}
