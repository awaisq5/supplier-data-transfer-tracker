import { useCallback, useEffect, useMemo, useState } from 'react'
import { sampleRegister } from '../data/sample'
import { viewOf, type AgreementView } from '../domain/documents'
import { type Agreement, DEFAULT_SETTINGS, type Settings } from '../domain/types'

const KEY = 'supplier-data-transfer-tracker:v1'

interface Saved {
  agreements: Agreement[]
  settings: Settings
}

export const TODAY = new Date().toISOString().slice(0, 10)

function load(): Saved | undefined {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Saved
    if (!Array.isArray(parsed.agreements)) return undefined
    return { agreements: parsed.agreements, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }
  } catch {
    return undefined
  }
}

function save(state: Saved): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function isBackup(x: unknown): x is Saved {
  return typeof x === 'object' && x !== null && Array.isArray((x as Saved).agreements)
}

export function useRegister() {
  const [state, setState] = useState<Saved>(() => load() ?? { agreements: sampleRegister(TODAY), settings: DEFAULT_SETTINGS })
  const [persisted, setPersisted] = useState(true)

  useEffect(() => {
    setPersisted(save(state))
  }, [state])

  const views = useMemo<AgreementView[]>(
    () => state.agreements.map((a) => viewOf(a, state.settings, TODAY)),
    [state.agreements, state.settings],
  )

  const update = useCallback((a: Agreement) => {
    setState((s) => {
      const exists = s.agreements.some((x) => x.id === a.id)
      return { ...s, agreements: exists ? s.agreements.map((x) => (x.id === a.id ? a : x)) : [...s.agreements, a] }
    })
  }, [])

  const remove = useCallback((id: string) => {
    setState((s) => ({ ...s, agreements: s.agreements.filter((x) => x.id !== id) }))
  }, [])

  const replaceAll = useCallback((agreements: Agreement[]) => setState((s) => ({ ...s, agreements })), [])
  const restore = useCallback((backup: Saved) => setState({ agreements: backup.agreements, settings: { ...DEFAULT_SETTINGS, ...backup.settings } }), [])
  const reset = useCallback(() => setState((s) => ({ ...s, agreements: sampleRegister(TODAY) })), [])
  const setSettings = useCallback((settings: Settings) => setState((s) => ({ ...s, settings })), [])

  return { ...state, views, persisted, update, remove, replaceAll, restore, reset, setSettings }
}

export type Register = ReturnType<typeof useRegister>
