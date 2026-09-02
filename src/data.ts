import type { Component, Dataset, Kanji, Level, Strokes, VocabIndex } from './types'

export const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1']
/** What the browser lists by default. N1 kanji stay in the data so build-up
 *  chains never dead-end (日 → 旭), but they don't clutter the study list. */
export const STUDY_LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2']

export interface KanjiIndex {
  data: Dataset
  /** component char -> kanji chars that contain it */
  byComponent: Map<string, string[]>
  all: Kanji[]
}

let cache: Promise<KanjiIndex> | null = null
let strokeCache: Promise<Strokes> | null = null

const base = import.meta.env.BASE_URL

export function loadIndex(): Promise<KanjiIndex> {
  if (!cache) {
    cache = fetch(`${base}data/kanji.json`)
      .then((r) => r.json() as Promise<Dataset>)
      .then((data) => {
        const byComponent = new Map<string, string[]>()
        const all = Object.values(data.kanji)
        for (const k of all) {
          for (const c of k.comp) {
            const list = byComponent.get(c)
            if (list) list.push(k.c)
            else byComponent.set(c, [k.c])
          }
        }
        return { data, byComponent, all }
      })
  }
  return cache
}

let vocabCache: Promise<VocabIndex> | null = null

/** Words using each kanji, with a Tatoeba example sentence. Loaded on demand —
 *  nothing needs it until you modifier-click a character. */
export function loadVocab(): Promise<VocabIndex> {
  if (!vocabCache) {
    vocabCache = fetch(`${base}data/vocab.json`).then((r) => r.json() as Promise<VocabIndex>)
  }
  return vocabCache
}

export function loadStrokes(): Promise<Strokes> {
  if (!strokeCache) {
    strokeCache = fetch(`${base}data/strokes.json`).then((r) => r.json() as Promise<Strokes>)
  }
  return strokeCache
}

export function componentLabel(idx: KanjiIndex, ch: string): string {
  const c: Component | undefined = idx.data.components[ch]
  const k = idx.data.kanji[ch]
  const meanings = k?.m?.length ? k.m : c?.m
  return meanings && meanings.length ? meanings[0] : ''
}

export interface Neighbour {
  kanji: Kanji
  /** components shared with the focus kanji */
  shared: string[]
  score: number
}

/**
 * Kanji that resemble `focus` because they are built from the same components.
 * Rare shared components score much higher than ubiquitous ones (一, 口 ...),
 * which is what makes the graph feel meaningful rather than fully connected.
 */
export function neighbours(idx: KanjiIndex, focus: Kanji, limit = 24): Neighbour[] {
  const scores = new Map<string, { shared: string[]; score: number }>()
  for (const comp of focus.comp) {
    const holders = idx.byComponent.get(comp)
    if (!holders || holders.length > 220) continue
    const weight = 1 / Math.log2(holders.length + 2)
    for (const other of holders) {
      if (other === focus.c) continue
      const entry = scores.get(other) ?? { shared: [], score: 0 }
      entry.shared.push(comp)
      entry.score += weight * (1 + (idx.data.components[comp]?.n ?? 1) / 6)
      scores.set(other, entry)
    }
  }
  return [...scores.entries()]
    .map(([c, v]) => ({ kanji: idx.data.kanji[c], shared: v.shared, score: v.score }))
    .filter((n) => n.kanji)
    .sort((a, b) => b.score - a.score || a.kanji.s - b.kanji.s)
    .slice(0, limit)
}

export function kanjiWithComponent(idx: KanjiIndex, comp: string): Kanji[] {
  return (idx.byComponent.get(comp) ?? [])
    .map((c) => idx.data.kanji[c])
    .filter(Boolean)
    .sort((a, b) => LEVELS.indexOf(a.l) - LEVELS.indexOf(b.l) || a.s - b.s)
}

export function search(idx: KanjiIndex, q: string, levels: Set<Level>): Kanji[] {
  const query = q.trim().toLowerCase()
  return idx.all
    .filter((k) => levels.has(k.l))
    .filter((k) => {
      if (!query) return true
      if (query.length === 1 && query >= '　') return k.c === query || k.comp.includes(query)
      return (
        k.c === query ||
        k.m.some((m) => m.toLowerCase().includes(query)) ||
        k.on.some((r) => r.includes(query)) ||
        k.kun.some((r) => r.includes(query))
      )
    })
    .sort((a, b) => LEVELS.indexOf(a.l) - LEVELS.indexOf(b.l) || (a.f ?? 9999) - (b.f ?? 9999))
}
