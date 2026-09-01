import type { KanjiIndex } from './data'
import type { Kanji, Level } from './types'

/**
 * Build-up model: a kanji is its parent kanji plus one more piece.
 *   日 ──(+九 きゅう)──▶ 旭
 *   日 ──(+寺 てら)────▶ 時
 * Everything here is deterministic (fixed sort keys, no randomness) so the same
 * kanji always draws the same tree.
 */

/** さんずい ／ water — whatever we can say about a component's identity. */
export interface RadicalName {
  char: string
  jp: string
  en: string
  /** true when this is one of the 214 classical radicals */
  isRadical: boolean
}

export function radicalName(idx: KanjiIndex, ch: string): RadicalName {
  const comp = idx.data.components[ch]
  const kanji = idx.data.kanji[ch]
  const en =
    comp?.en ??
    (kanji?.m?.[0] ?? comp?.m?.[0] ?? '')
      .replace(/\s*Radical.*$/i, '')
      .toLowerCase()
  const jp = comp?.jp ?? ''
  return { char: ch, jp, en, isRadical: Boolean(comp?.num) }
}

/** KanjiVG position codes, in the words a learner would actually use. */
const POSITION: Record<string, string> = {
  left: 'left · へん',
  right: 'right · つくり',
  top: 'top · かんむり',
  bottom: 'bottom · あし',
  nyo: 'wraps left-bottom · にょう',
  nyoc: 'wraps left-bottom · にょう',
  tare: 'hangs top-left · たれ',
  kamae: 'encloses · かまえ',
}

export function positionLabel(p: string): string {
  return POSITION[p] ?? p
}

export function nameLabel(n: RadicalName): string {
  if (n.jp && n.en) return `${n.jp} · ${n.en}`
  return n.jp || n.en || ''
}

/** Components of a character, expanded one level (kanji know their own tree). */
function partsOf(idx: KanjiIndex, ch: string): string[] {
  return idx.data.kanji[ch]?.comp ?? []
}

/** 氵 and 水 are the same radical wearing different clothes. */
function canonical(idx: KanjiIndex, ch: string): string {
  return idx.data.components[ch]?.o ?? ch
}

/**
 * What you must add to `parent` to reach `child`, with pieces that are merely
 * sub-parts of other pieces removed (時 = 日 + 寺, not 日 + 寺 + 土 + 寸).
 */
export function addedParts(idx: KanjiIndex, parent: string, child: Kanji): string[] {
  const owned = new Set<string>([parent, canonical(idx, parent), ...partsOf(idx, parent)])
  for (const p of partsOf(idx, parent)) owned.add(canonical(idx, p))
  const rest = child.comp.filter((c) => !owned.has(c) && !owned.has(canonical(idx, c)))
  // drop anything contained in another remaining piece
  return rest
    .filter((c) => !rest.some((other) => other !== c && partsOf(idx, other).includes(c)))
    .sort((a, b) => (idx.data.components[b]?.n ?? 0) - (idx.data.components[a]?.n ?? 0) || (a < b ? -1 : 1))
}

export interface Edge {
  from: string
  to: string
  added: string[]
}

/** Kanji that `child` is built on top of, simplest link first. */
export function parentsOf(idx: KanjiIndex, child: Kanji, limit = 3): Edge[] {
  const seen = new Set<string>()
  const out: Edge[] = []
  for (const raw of child.comp) {
    for (const cand of [raw, canonical(idx, raw)]) {
      const parent = idx.data.kanji[cand]
      if (!parent || parent.c === child.c || seen.has(parent.c)) continue
      if (parent.s >= child.s) continue
      const added = addedParts(idx, parent.c, child)
      if (!added.length) continue
      seen.add(parent.c)
      out.push({ from: parent.c, to: child.c, added })
    }
  }
  return out
    .sort(
      (a, b) =>
        a.added.length - b.added.length ||
        (idx.data.kanji[b.from]?.s ?? 0) - (idx.data.kanji[a.from]?.s ?? 0) ||
        (a.from < b.from ? -1 : 1),
    )
    .slice(0, limit)
}

const LEVEL_ORDER: Record<Level, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 }

/** Kanji built by adding something to `parent`. */
export function childrenOf(idx: KanjiIndex, parent: Kanji, limit = 7): Edge[] {
  const holders = new Set<string>()
  for (const form of [parent.c, ...Object.keys(idx.data.components).filter((c) => canonical(idx, c) === parent.c)]) {
    for (const h of idx.byComponent.get(form) ?? []) holders.add(h)
  }
  const edges: Edge[] = []
  for (const ch of holders) {
    const child = idx.data.kanji[ch]
    if (!child || child.c === parent.c || child.s <= parent.s) continue
    const added = addedParts(idx, parent.c, child)
    if (!added.length) continue
    edges.push({ from: parent.c, to: child.c, added })
  }
  return edges
    .sort((a, b) => {
      const ka = idx.data.kanji[a.to]
      const kb = idx.data.kanji[b.to]
      return (
        a.added.length - b.added.length ||
        LEVEL_ORDER[ka.l] - LEVEL_ORDER[kb.l] ||
        (ka.f ?? 9999) - (kb.f ?? 9999) ||
        (a.to < b.to ? -1 : 1)
      )
    })
    .slice(0, limit)
}

export interface TreeNode {
  ch: string
  col: number
  row: number
}

export interface Tree {
  nodes: TreeNode[]
  edges: Edge[]
  cols: number[]
}

/**
 * Columns run simple → complex: ancestors on the left, the focus kanji in the
 * middle, what is built from it on the right.
 */
export function buildTree(idx: KanjiIndex, focus: Kanji): Tree {
  const edges: Edge[] = []
  const byCol = new Map<number, string[]>()
  const place = (ch: string, col: number) => {
    const list = byCol.get(col) ?? []
    if (!list.includes(ch)) list.push(ch)
    byCol.set(col, list)
  }
  const placed = new Set<string>([focus.c])
  place(focus.c, 0)

  // ── left: where the focus came from
  const p1 = parentsOf(idx, focus, 3)
  for (const e of p1) {
    if (placed.has(e.from)) continue
    placed.add(e.from)
    place(e.from, -1)
    edges.push(e)
  }
  const grandparents = p1.slice(0, 2)
  for (const e of grandparents) {
    const parent = idx.data.kanji[e.from]
    if (!parent) continue
    for (const g of parentsOf(idx, parent, 1)) {
      if (placed.has(g.from)) continue
      placed.add(g.from)
      place(g.from, -2)
      edges.push(g)
    }
  }

  // ── right: what is built on the focus
  const c1 = childrenOf(idx, focus, 7)
  for (const e of c1) {
    if (placed.has(e.to)) continue
    placed.add(e.to)
    place(e.to, 1)
    edges.push(e)
  }
  let budget = 8
  for (const e of c1) {
    if (budget <= 0) break
    const child = idx.data.kanji[e.to]
    if (!child) continue
    for (const g of childrenOf(idx, child, 2)) {
      if (budget <= 0) break
      if (placed.has(g.to)) continue
      placed.add(g.to)
      place(g.to, 2)
      edges.push(g)
      budget -= 1
    }
  }

  const nodes: TreeNode[] = []
  for (const [col, list] of byCol) {
    list.forEach((ch, row) => nodes.push({ ch, col, row }))
  }
  return { nodes, edges, cols: [...byCol.keys()].sort((a, b) => a - b) }
}
