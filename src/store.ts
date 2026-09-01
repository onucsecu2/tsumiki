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

export const SHEET_KEY = 'hitechl.sheet'
export const SRS_KEY = 'hitechl.srs'

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
