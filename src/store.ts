import { useCallback, useEffect, useState } from 'react'

/** Tiny localStorage-backed store shared across views (no auth, single user). */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode / quota — practice still works for this session */
  }
}

const subs = new Map<string, Set<() => void>>()

function notify(key: string) {
  subs.get(key)?.forEach((fn) => fn())
}

/** After a bulk change (import, reset) every hook has to re-read. */
function notifyAll() {
  for (const set of subs.values()) set.forEach((fn) => fn())
}

export function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback))

  useEffect(() => {
    const fn = () => setValue(read(key, fallback))
    let set = subs.get(key)
    if (!set) {
      set = new Set()
      subs.set(key, set)
    }
    set.add(fn)
    return () => {
      set.delete(fn)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        write(key, v)
        notify(key)
        return v
      })
    },
    [key],
  )

  return [value, update] as const
}

export const SHEET_KEY = 'tsumiki.sheet'
export const SRS_KEY = 'tsumiki.srs'
export const ROOTS_KEY = 'tsumiki.roots'

/** Everything this app keeps on the device, by the name it exports under. */
export const STORE: Record<string, string> = {
  sheet: SHEET_KEY,
  srs: SRS_KEY,
  roots: ROOTS_KEY,
}

// The app used to be called hitechl; carry those keys over once so nobody
// loses a study history to a rename.
;(function migrate() {
  try {
    for (const [from, to] of [
      ['hitechl.sheet', SHEET_KEY],
      ['hitechl.srs', SRS_KEY],
    ]) {
      const old = localStorage.getItem(from)
      if (old !== null && localStorage.getItem(to) === null) localStorage.setItem(to, old)
      if (old !== null) localStorage.removeItem(from)
    }
  } catch {
    /* storage unavailable — nothing to migrate */
  }
})()

export interface SrsCard {
  /** 0 = new, grows with each correct answer */
  box: number
  due: number
  seen: number
  wrong: number
}

export type SrsState = Record<string, SrsCard>

/** Leitner-style intervals, in days. */
const INTERVALS = [0, 1, 2, 4, 8, 16, 32]
const DAY = 86_400_000

export function grade(card: SrsCard | undefined, correct: boolean): SrsCard {
  const prev = card ?? { box: 0, due: 0, seen: 0, wrong: 0 }
  const box = correct ? Math.min(prev.box + 1, INTERVALS.length - 1) : 0
  return {
    box,
    due: Date.now() + INTERVALS[box] * DAY,
    seen: prev.seen + 1,
    wrong: prev.wrong + (correct ? 0 : 1),
  }
}

export function isDue(card: SrsCard | undefined) {
  return !card || card.due <= Date.now()
}

export function useSheet() {
  const [sheet, setSheet] = usePersisted<string[]>(SHEET_KEY, [])
  const toggle = useCallback(
    (ch: string) =>
      setSheet((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch])),
    [setSheet],
  )
  return { sheet, setSheet, toggle }
}

/* ── backup, restore, reset ─────────────────────────────────────────────── */

export interface Backup {
  app: 'tsumiki'
  version: 1
  exportedAt: string
  data: Record<string, unknown>
}

export function exportData(): Backup {
  const data: Record<string, unknown> = {}
  for (const [name, key] of Object.entries(STORE)) {
    const raw = read<unknown>(key, null)
    if (raw !== null) data[name] = raw
  }
  return { app: 'tsumiki', version: 1, exportedAt: new Date().toISOString(), data }
}

export interface StoreStats {
  sheet: number
  roots: number
  srs: number
  learned: number
}

export function storeStats(): StoreStats {
  const srs = read<SrsState>(SRS_KEY, {})
  return {
    sheet: read<string[]>(SHEET_KEY, []).length,
    roots: read<string[]>(ROOTS_KEY, []).length,
    srs: Object.keys(srs).length,
    learned: Object.values(srs).filter((c) => c && c.box >= 3).length,
  }
}

export type ImportMode = 'replace' | 'merge'

export interface ImportResult {
  ok: boolean
  message: string
}

/** Newer/stronger card wins, so merging two devices never loses progress. */
function mergeSrs(a: SrsState, b: SrsState): SrsState {
  const out: SrsState = { ...a }
  for (const [ch, card] of Object.entries(b)) {
    const mine = out[ch]
    if (!mine || card.box > mine.box || (card.box === mine.box && card.due > mine.due)) {
      out[ch] = card
    }
  }
  return out
}

function uniq(list: string[]): string[] {
  return [...new Set(list)]
}

export function importData(raw: unknown, mode: ImportMode): ImportResult {
  if (!raw || typeof raw !== 'object') return { ok: false, message: 'That file is not JSON.' }
  const backup = raw as Partial<Backup>
  if (backup.app !== 'tsumiki' || !backup.data || typeof backup.data !== 'object') {
    return { ok: false, message: "That doesn't look like a Tsumiki backup." }
  }

  const incoming = backup.data as Record<string, unknown>
  const applied: string[] = []
  try {
    if (Array.isArray(incoming.sheet)) {
      const list = (incoming.sheet as unknown[]).filter((x): x is string => typeof x === 'string')
      const next = mode === 'merge' ? uniq([...read<string[]>(SHEET_KEY, []), ...list]) : uniq(list)
      write(SHEET_KEY, next)
      applied.push(`${next.length} on the writing sheet`)
    }
    if (Array.isArray(incoming.roots)) {
      const list = (incoming.roots as unknown[]).filter((x): x is string => typeof x === 'string')
      const next = mode === 'merge' ? uniq([...read<string[]>(ROOTS_KEY, []), ...list]) : uniq(list)
      write(ROOTS_KEY, next)
      applied.push(`${next.length} root${next.length === 1 ? '' : 's'}`)
    }
    if (incoming.srs && typeof incoming.srs === 'object') {
      const list = incoming.srs as SrsState
      const next = mode === 'merge' ? mergeSrs(read<SrsState>(SRS_KEY, {}), list) : list
      write(SRS_KEY, next)
      applied.push(`${Object.keys(next).length} practice cards`)
    }
  } catch {
    return { ok: false, message: 'Could not write to storage.' }
  }

  notifyAll()
  if (!applied.length) return { ok: false, message: 'Nothing recognisable in that file.' }
  return { ok: true, message: `${mode === 'merge' ? 'Merged' : 'Restored'}: ${applied.join(', ')}.` }
}

export function resetData() {
  try {
    for (const key of Object.values(STORE)) localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  notifyAll()
}
