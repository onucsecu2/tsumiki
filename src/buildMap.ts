import { composition, compositionParts, partName } from './derive'
import type { CompNode } from './derive'
import type { KanjiIndex } from './data'
import type { Kanji } from './types'

/**
 * A build-map puzzle: the same tree the 組み立て graph draws, but every kanji in
 * it is blank and you type it from its English meaning. The leftmost radicals
 * are printed — they're the raw material, and most of them (丆, 𦰩) can't be
 * entered on a Japanese keyboard anyway.
 *
 * Deliberately not bound to a JLPT level: the puzzle is chosen by the shape of
 * its tree, not by which exam the character sits in.
 */

export interface Slot {
  key: string
  ch: string
  /** English meaning — the only clue */
  clue: string
  /** printed for you (a radical), or a blank to fill */
  given: boolean
  depth: number
  slot: number
  parts: string[]
  strokes: number
}

export interface Puzzle {
  target: Kanji
  nodes: Slot[]
  /** part key → whole key */
  links: { from: string; to: string }[]
  span: number
  maxDepth: number
  /** how many blanks there are to fill */
  blanks: number
}

function clueFor(idx: KanjiIndex, ch: string, given: boolean): string {
  const k = idx.data.kanji[ch]
  if (!given && k?.m?.length) return k.m.slice(0, 2).join(', ')
  return partName(idx, ch).primary
}

/** A node is typeable when it's a kanji in its own right. */
function typeable(idx: KanjiIndex, ch: string): boolean {
  return Boolean(idx.data.kanji[ch])
}

export function buildPuzzle(idx: KanjiIndex, target: Kanji, maxDepth = 3): Puzzle {
  const comp = composition(idx, target, maxDepth)
  const nodes: Slot[] = comp.nodes
    .filter((n) => !n.ghost)
    .map((n: CompNode) => ({
      key: n.key,
      ch: n.ch,
      // For a blank you have to type, the kanji's own meaning is the fair clue;
      // WaniKani's mnemonic ("Top Hat" for 且) is evocative for a radical you
      // can see but useless as something to answer from.
      clue: clueFor(idx, n.ch, !typeable(idx, n.ch) || (n.leaf && n.depth > 0)),
      // the target and every intermediate kanji are blanks; leaves that are
      // only radicals are given
      given: !typeable(idx, n.ch) || (n.leaf && n.depth > 0),
      depth: n.depth,
      slot: n.slot,
      parts: n.parts.filter((p) => !p.ghost).map((p) => p.ch),
      strokes: idx.data.kanji[n.ch]?.s ?? idx.data.components[n.ch]?.n ?? 0,
    }))

  const links: { from: string; to: string }[] = []
  for (const n of comp.nodes) {
    for (const p of n.parts) {
      if (p.ghost) continue
      links.push({ from: `${n.key}/${p.ch}`, to: n.key })
    }
  }

  return {
    target,
    nodes,
    links: links.filter((l) => nodes.some((n) => n.key === l.from) && nodes.some((n) => n.key === l.to)),
    span: comp.span,
    maxDepth: comp.maxDepth,
    blanks: nodes.filter((n) => !n.given).length,
  }
}

/**
 * Kanji that make a puzzle worth solving: at least two blanks to fill and a
 * clue on every one of them. Computed once and cached, because it walks the
 * whole set.
 */
let pool: Kanji[] | null = null

export function puzzlePool(idx: KanjiIndex): Kanji[] {
  if (pool) return pool
  pool = idx.all.filter((k) => {
    const parts = compositionParts(idx, k.c)
    if (parts.length < 2) return false
    // needs at least one typeable part, so the map has an intermediate step
    if (!parts.some((p) => !p.ghost && typeable(idx, p.ch))) return false
    if (!partName(idx, k.c).primary) return false
    return parts.every((p) => p.ghost || partName(idx, p.ch).primary)
  })
  return pool
}

/**
 * Weighted pick. The mode isn't bound to a JLPT level — every kanji is
 * eligible — but a flat random draw lands on N1 more than half the time and
 * hands you 誼 "Best Regards" to type, which is not a puzzle so much as a
 * dead end. Weighting by frequency keeps every level in play while making the
 * characters ones you plausibly know.
 */
/** Only characters common enough to be worth learning make puzzles. Every
 *  JLPT level stays eligible — a flat draw over all 2211 kanji just lands on
 *  N1 more than half the time and hands you 誼 "Best Regards" to type. */
const FREQ_LIMIT = 1000

function weightFor(k: Kanji): number {
  return 1 / Math.sqrt((k.f ?? FREQ_LIMIT) + 8)
}

export function randomPuzzle(idx: KanjiIndex, avoid?: string): Puzzle | null {
  const candidates = puzzlePool(idx).filter((k) => (k.f ?? Infinity) <= FREQ_LIMIT)
  if (!candidates.length) return null
  const total = candidates.reduce((sum, k) => sum + weightFor(k), 0)

  for (let tries = 0; tries < 40; tries++) {
    let r = Math.random() * total
    let pick = candidates[0]
    for (const k of candidates) {
      r -= weightFor(k)
      if (r <= 0) {
        pick = k
        break
      }
    }
    if (pick.c === avoid) continue
    const p = buildPuzzle(idx, pick)
    if (p.blanks >= 2 && p.blanks <= 6) return p
  }
  return buildPuzzle(idx, candidates[0])
}
