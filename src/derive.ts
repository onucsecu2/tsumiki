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


/* ────────────────────────────────────────────────────────────────────────
   Composition model: parts converge on the character they build.

   丆 ─┐
       ├→ 石 ─┐
   口 ─┘      ├→ 岩
   山 ────────┘

   Each fact is stated once, and every merge node is itself a character whose
   own parts sit one column further left. The composition itself is decided at
   build time (scripts/compose.py) so the runtime only lays it out.
   ──────────────────────────────────────────────────────────────────────── */

export interface CompPart {
  ch: string
  /** 林 = 木 ×2 — repeats collapse into one node with a multiplier */
  count: number
  /** a placeholder for strokes no named part accounts for */
  ghost?: boolean
  /** how many strokes the ghost stands in for */
  strokes?: number
}

const GHOST = '\u0000ghost'

/** How a character breaks down, or [] for one you learn whole. */
export function compositionParts(idx: KanjiIndex, ch: string): CompPart[] {
  const k = idx.data.kanji[ch]
  if (!k) return []
  const raw = k.parts ?? (k.atom ? [] : k.d.map((p) => p.e))
  const out: CompPart[] = []
  for (const p of raw) {
    if (p === ch) continue
    const hit = out.find((o) => o.ch === p)
    if (hit) hit.count += 1
    else out.push({ ch: p, count: 1 })
  }
  if (out.length && k.gap) out.push({ ch: GHOST, count: 1, ghost: true, strokes: k.gap })
  return out
}

export function isGhost(key: string): boolean {
  return key.endsWith(GHOST)
}

/** Layout key of the ghost input belonging to `parentKey`. */
export function ghostKey(parentKey: string): string {
  return `${parentKey}${GHOST}`
}

/** True when a part is an IDS description (⿰⿱…) rather than a real glyph. */
export function isUnrenderable(idx: KanjiIndex, ch: string): boolean {
  return Boolean(idx.data.components[ch]?.ids)
}

/** The best short label for a part: WaniKani's name, else the character's own
 *  meaning; the bushu name in kana comes along as the secondary line. */
export function partName(idx: KanjiIndex, ch: string): { primary: string; secondary: string } {
  const c = idx.data.components[ch]
  const k = idx.data.kanji[ch]
  const primary = c?.wk ?? k?.m?.[0] ?? c?.m?.[0]?.replace(/\s*Radical.*$/i, '') ?? ''
  return { primary, secondary: c?.jp ?? '' }
}

/** Hiragana → katakana: on'yomi is conventionally written in katakana. */
export function toKatakana(kana: string): string {
  return kana.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

/** Readings to show under a part. Radicals have none, so the bushu name stands
 *  in for the on'yomi line. */
export function partReadings(
  idx: KanjiIndex,
  ch: string,
): { on: string; kun: string; bushu: string } {
  const k = idx.data.kanji[ch]
  const bushu = idx.data.components[ch]?.jp ?? ''
  const clean = (r?: string) => (r ?? '').replace(/^-|-$/g, '')
  return {
    on: k?.on?.length ? toKatakana(clean(k.on[0])) : '',
    kun: clean(k?.kun?.[0]),
    bushu,
  }
}

export interface CompNode {
  /** unique layout key — a ghost is scoped to its parent */
  key: string
  ch: string
  /** 0 = the focus kanji, 1 = its parts, 2 = their parts … */
  depth: number
  slot: number
  parts: CompPart[]
  count: number
  leaf: boolean
  ghost: boolean
  strokes?: number
}

export interface Composition {
  nodes: CompNode[]
  maxDepth: number
  span: number
}

/**
 * Layered layout of the focus character's full ancestry.
 *
 * Two passes, because this is a DAG and not a tree: 森 is 木 + 林 and 林 is
 * 木 + 木, so 木 is reached at two different depths. Pass one gives every
 * character its *longest* distance from the focus, which guarantees each arrow
 * points left-to-right; pass two assigns rows, leaves in traversal order and
 * every merge node centred on the parts feeding it.
 */
export function composition(idx: KanjiIndex, focus: Kanji, maxDepth = 4): Composition {
  const partsOf = new Map<string, CompPart[]>()
  const depth = new Map<string, number>()

  // ── pass 1: longest-path depth
  const walk = (ch: string, at: number, stack: Set<string>) => {
    const seen = depth.get(ch)
    if (seen !== undefined && seen >= at) return
    depth.set(ch, at)
    if (at >= maxDepth || stack.has(ch)) {
      partsOf.set(ch, [])
      return
    }
    const parts = compositionParts(idx, ch).filter((p) => p.ghost || !stack.has(p.ch))
    partsOf.set(ch, parts)
    const next = new Set(stack).add(ch)
    for (const p of parts) {
      if (p.ghost) continue
      walk(p.ch, at + 1, next)
    }
  }
  walk(focus.c, 0, new Set())

  // ── pass 2: rows
  const slot = new Map<string, number>()
  let cursor = 0
  const rows = (ch: string, guard: Set<string>): number => {
    const had = slot.get(ch)
    if (had !== undefined) return had
    if (guard.has(ch)) return 0
    const parts = (partsOf.get(ch) ?? []).filter((p) => !p.ghost)
    let value: number
    if (!parts.length) {
      value = cursor
      cursor += 1
    } else {
      const next = new Set(guard).add(ch)
      const kids = parts.map((p) => rows(p.ch, next))
      value = kids.reduce((a, b) => a + b, 0) / kids.length
    }
    slot.set(ch, value)
    return value
  }
  rows(focus.c, new Set())

  const nodes: CompNode[] = []
  for (const [ch, at] of depth) {
    const parts = partsOf.get(ch) ?? []
    nodes.push({
      key: ch,
      ch,
      depth: at,
      slot: slot.get(ch) ?? 0,
      parts,
      count: 1,
      leaf: !parts.length,
      ghost: false,
    })
    // a ghost input belongs to one parent, so it gets its own row
    const gap = parts.find((p) => p.ghost)
    if (gap) {
      nodes.push({
        key: ghostKey(ch),
        ch: GHOST,
        depth: at + 1,
        slot: cursor,
        parts: [],
        count: 1,
        leaf: true,
        ghost: true,
        strokes: gap.strokes,
      })
      cursor += 1
    }
  }

  // the multiplier a part carries where it feeds a merge (林 = 木 ×2)
  for (const n of nodes) {
    for (const p of n.parts) {
      if (p.count > 1) {
        const target = nodes.find((x) => x.key === p.ch)
        if (target) target.count = Math.max(target.count, p.count)
      }
    }
  }

  const maxSeen = Math.max(...[...depth.values()], 0)
  return { nodes, maxDepth: maxSeen, span: Math.max(cursor, 1) }
}

/** Kanji built by adding something to `focus`, with the full recipe of each. */
export interface Recipe {
  ch: string
  parts: CompPart[]
}

export function recipesUsing(idx: KanjiIndex, focus: Kanji, limit = 6): Recipe[] {
  const forms = new Set<string>([focus.c])
  for (const [c, info] of Object.entries(idx.data.components)) {
    if (info.o === focus.c) forms.add(c)
  }
  const candidates = new Set<string>()
  for (const f of forms) for (const h of idx.byComponent.get(f) ?? []) candidates.add(h)

  const out: Recipe[] = []
  for (const holder of candidates) {
    const k = idx.data.kanji[holder]
    if (!k || k.c === focus.c) continue
    const parts = compositionParts(idx, k.c)
    if (!parts.some((p) => forms.has(p.ch))) continue
    out.push({ ch: k.c, parts })
  }
  return out
    .sort((a, b) => {
      const ka = idx.data.kanji[a.ch]
      const kb = idx.data.kanji[b.ch]
      return (
        a.parts.length - b.parts.length ||
        LEVEL_ORDER[ka.l] - LEVEL_ORDER[kb.l] ||
        (ka.f ?? 9999) - (kb.f ?? 9999) ||
        (a.ch < b.ch ? -1 : 1)
      )
    })
    .slice(0, limit)
}
