import { useEffect, useMemo, useState } from 'react'
import StrokePaths, { EDGE_MS, LEAF_STAGGER, drawTime, groupOffsets } from '../components/StrokePaths'
import { usePersisted } from '../store'
import type { KanjiIndex } from '../data'
import type { Kanji } from '../types'
import { composition, ghostKey, isUnrenderable, partName, partReadings, recipesUsing } from '../derive'
import type { CompNode } from '../derive'

const COL_W = 195
const ROW_H = 126
const R = 33
/** how far left of a node its merge bus sits */
const BUS = 64
/** vertical lane used to route a part that spans more than one column */
const LANE = 74

/** ⌘ on macOS, Ctrl elsewhere, Alt either way. */
export function isVocabClick(e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean }) {
  return e.ctrlKey || e.metaKey || e.altKey
}

interface Props {
  idx: KanjiIndex
  focus: Kanji
  setFocus: (ch: string) => void
  onVocab: (ch: string, e: { clientX: number; clientY: number }) => void
}

/**
 * 丆 ─┐
 *     ├→ 石 ─┐
 * 口 ─┘      ├→ 岩
 * 山 ────────┘
 */
export default function BuildTree({ idx, focus, setFocus, onVocab }: Props) {
  const comp = useMemo(() => composition(idx, focus), [idx, focus])
  const recipes = useMemo(() => recipesUsing(idx, focus), [idx, focus])

  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    const mid = (comp.span - 1) / 2
    for (const n of comp.nodes) m.set(n.key, { x: -n.depth * COL_W, y: (n.slot - mid) * ROW_H })
    return m
  }, [comp])

  const built = useMemo(() => {
    const mid = (recipes.length - 1) / 2
    return recipes.map((r, i) => ({ ...r, x: COL_W * 1.3, y: (i - mid) * (ROW_H * 0.86) }))
  }, [recipes])

  const depthOf = useMemo(() => new Map(comp.nodes.map((n) => [n.key, n.depth])), [comp])

  const [runId, setRunId] = useState(0)
  // 1 = normal, 4 = quarter speed. Persisted, because it's a study preference.
  const [factor, setFactor] = usePersisted<number>('tsumiki.speed', 1)

  /**
   * When each node starts drawing. A node waits for every part feeding it to
   * finish, plus the time its connector takes to reach the merge; leaves are
   * staggered top to bottom so the tree doesn't start all at once.
   */
  const timing = useMemo(() => {
    const byKey = new Map(comp.nodes.map((n) => [n.key, n]))
    const start = new Map<string, number>()
    const end = new Map<string, number>()
    const leaves = comp.nodes
      .filter((n) => n.leaf)
      .sort((a, b) => a.slot - b.slot || a.depth - b.depth)
    const leafOrder = new Map(leaves.map((n, i) => [n.key, i]))

    const strokesOf = (n: CompNode) =>
      n.ghost ? 0 : (idx.data.kanji[n.ch]?.s ?? idx.data.components[n.ch]?.n ?? 0)

    /** KanjiVG groups the strokes of a kanji by component, in writing order —
     *  use that so the character lands one part at a time. */
    const groupsOf = (n: CompNode): number[] | undefined => {
      const k = idx.data.kanji[n.ch]
      if (!k?.d?.length) return undefined
      const counts = k.d.map((p) => p.n)
      const total = counts.reduce((a, b) => a + b, 0)
      return counts.length > 1 && total === k.s ? counts : undefined
    }

    const resolve = (n: CompNode, guard: Set<string>): number => {
      const known = end.get(n.key)
      if (known !== undefined) return known
      if (guard.has(n.key)) return 0
      const next = new Set(guard).add(n.key)
      const feeders = n.parts
        .map((p) => byKey.get(p.ghost ? ghostKey(n.key) : p.ch))
        .filter(Boolean) as CompNode[]
      const at = feeders.length
        ? Math.max(...feeders.map((f) => resolve(f, next) + EDGE_MS * factor))
        : (leafOrder.get(n.key) ?? 0) * LEAF_STAGGER * factor
      start.set(n.key, at)
      const done = at + drawTime(strokesOf(n), groupsOf(n)?.length ?? 1, factor)
      end.set(n.key, done)
      return done
    }
    for (const n of comp.nodes) resolve(n, new Set())

    return { start, end, groupsOf }
  }, [comp, idx, factor])

  /** what the focus builds into only appears once the focus itself is finished */
  const afterFocus = timing.end.get(focus.c) ?? 0

  /**
   * Which part is being written right now, while the focus kanji draws itself
   * component by component. Its node in the tree lights up and the rest dim, so
   * you can see 日 being written inside 時 and know where it came from.
   */
  const [writing, setWriting] = useState<string | null>(null)

  useEffect(() => {
    setWriting(null)
    const groups = timing.groupsOf(comp.nodes.find((n) => n.depth === 0)!)
    const parts = focus.d.map((p) => p.e)
    if (!groups || groups.length < 2) return
    const from = timing.start.get(focus.c) ?? 0
    const offsets = groupOffsets(groups, factor)
    const timers = offsets.map((at, i) =>
      window.setTimeout(() => setWriting(parts[i] ?? null), from + at),
    )
    timers.push(window.setTimeout(() => setWriting(null), timing.end.get(focus.c) ?? 0))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [comp, focus, timing, runId, factor])

  const view = useMemo(() => {
    const xs = [...pos.values()].map((p) => p.x).concat(built.map((b) => b.x))
    const ys = [...pos.values()].map((p) => p.y).concat(built.map((b) => b.y))
    // extra room on the right: the recipe labels run outward from their node
    const minX = Math.min(...xs, 0) - 130
    const maxX = Math.max(...xs, 0) + (built.length ? 220 : 130)
    const minY = Math.min(...ys, 0) - 80
    const maxY = Math.max(...ys, 0) + 80
    return { minX, minY, w: maxX - minX, h: maxY - minY }
  }, [pos, built])

  return (
    <div className="tree-wrap">
      {/* Remounting on focus (or replay) restarts every CSS animation from the
          top — changing animation-delay on a live element would not. */}
      <svg
        key={`${focus.c}:${runId}`}
        className="tree"
        viewBox={`${view.minX} ${view.minY} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="tree__arrowhead" />
          </marker>
        </defs>

        {comp.nodes
          .filter((n) => !n.leaf)
          .map((n) => {
            const to = pos.get(n.key)!
            const busX = to.x - BUS
            const feeds = n.parts
              .map((p) => {
                const key = p.ghost ? ghostKey(n.key) : p.ch
                const at = pos.get(key)
                // depth grows leftward, so a part is `span` columns away
                return at
                  ? {
                      ...at,
                      span: (depthOf.get(key) ?? n.depth + 1) - n.depth,
                      doneAt: timing.end.get(key) ?? 0,
                    }
                  : null
              })
              .filter(Boolean) as { x: number; y: number; span: number; doneAt: number }[]
            if (!feeds.length) return null
            const top = Math.min(...feeds.map((f) => f.y), to.y)
            const bottom = Math.max(...feeds.map((f) => f.y), to.y)
            const arriveAt = Math.max(...feeds.map((f) => f.doneAt))
            return (
              <g key={`m${n.key}`} className="tree__merge">
                {feeds.map((f, i) => {
                  const dir = Math.sign(to.y - f.y)
                  const lit = {
                    animationDelay: `${f.doneAt}ms`,
                    animationDuration: `${EDGE_MS * factor}ms`,
                  }
                  // A part more than one column away (木 feeds both 林 and 森)
                  // detours through a lane below the row, so the line doesn't
                  // run straight through the node sitting between them.
                  if (f.span > 1) {
                    const lane = f.y + LANE
                    return (
                      <path
                        key={i}
                        className="tree__long tree__draw"
                        pathLength={1}
                        style={lit}
                        d={`M ${f.x} ${f.y + R} V ${lane - 14} Q ${f.x} ${lane} ${f.x + 14} ${lane} H ${busX - 14} Q ${busX} ${lane} ${busX} ${lane - 14} V ${to.y + 6}`}
                      />
                    )
                  }
                  const d =
                    Math.abs(f.y - to.y) < 1
                      ? `M ${f.x + R} ${f.y} H ${busX}`
                      : `M ${f.x + R} ${f.y} H ${busX - 16} Q ${busX} ${f.y} ${busX} ${f.y + dir * 16}`
                  return <path key={i} className="tree__draw" pathLength={1} style={lit} d={d} />
                })}
                {bottom - top > 1 && (
                  <line
                    className="tree__bus tree__fade"
                    style={{ animationDelay: `${arriveAt}ms` }}
                    x1={busX}
                    y1={top}
                    x2={busX}
                    y2={bottom}
                  />
                )}
                <path
                  className="tree__out tree__draw"
                  pathLength={1}
                  style={{ animationDelay: `${arriveAt}ms`, animationDuration: `${EDGE_MS * factor}ms` }}
                  d={`M ${busX} ${to.y} H ${to.x - R - 9}`}
                  markerEnd="url(#arrow)"
                />
                {feeds.length > 1 && (
                  <g className="tree__fade" style={{ animationDelay: `${arriveAt}ms` }}>
                    <circle className="tree__plusdot" cx={busX} cy={to.y} r={11} />
                    <text className="tree__plussign" x={busX} y={to.y + 5}>
                      +
                    </text>
                  </g>
                )}
              </g>
            )
          })}

        {built.map((b) => (
          <path
            key={`b${b.ch}`}
            className="tree__onward tree__fade"
            style={{ animationDelay: `${afterFocus}ms` }}
            d={`M ${R} 0 C ${COL_W * 0.7} 0, ${COL_W * 0.7} ${b.y}, ${b.x - R - 9} ${b.y}`}
            markerEnd="url(#arrow)"
          />
        ))}

        {comp.nodes.map((n) => (
          <Node
            key={n.key}
            idx={idx}
            node={n}
            x={pos.get(n.key)!.x}
            y={pos.get(n.key)!.y}
            isFocus={n.depth === 0}
            onPick={setFocus}
            onVocab={onVocab}
            delay={timing.start.get(n.key) ?? 0}
            groups={timing.groupsOf(n)}
            runId={runId}
            factor={factor}
            onReplay={() => setRunId((r) => r + 1)}
            spotlight={writing ? (n.ch === writing ? 'lit' : n.depth === 0 ? null : 'dim') : null}
          />
        ))}

        {built.map((b) => (
          <g key={`n${b.ch}`}>
            <Node
              idx={idx}
              node={{
                key: b.ch,
                ch: b.ch,
                depth: -1,
                slot: 0,
                parts: [],
                count: 1,
                leaf: true,
                ghost: false,
              }}
              x={b.x}
              y={b.y}
              onPick={setFocus}
              onVocab={onVocab}
              delay={afterFocus}
              runId={runId}
              factor={factor}
              spotlight={writing ? 'dim' : null}
            />
            {/* the recipe sits beside the node, where nothing else competes */}
            <text
              className="tree__recipe jp tree__fade"
              style={{ animationDelay: `${afterFocus}ms` }}
              x={b.x + R + 12}
              y={b.y + 4}
            >
              {b.parts
                .map((p) => (p.ghost ? '…' : p.ch + (p.count > 1 ? `×${p.count}` : '')))
                .join(' ＋ ')}
            </text>
          </g>
        ))}

        {comp.maxDepth > 0 && (
          <text className="tree__coltitle" x={-comp.maxDepth * COL_W} y={view.minY + 24}>
            parts
          </text>
        )}
        <text className="tree__coltitle" x={0} y={view.minY + 24}>
          this kanji
        </text>
        {built.length > 0 && (
          <text className="tree__coltitle" x={COL_W * 1.3} y={view.minY + 24}>
            builds into
          </text>
        )}
      </svg>
      <div className="speed no-print">
        <button className={factor === 1 ? 'is-on' : ''} onClick={() => setFactor(1)}>
          標準 <small>1×</small>
        </button>
        <button className={factor !== 1 ? 'is-on' : ''} onClick={() => setFactor(4)}>
          ゆっくり <small>0.25×</small>
        </button>
      </div>
      <p className="graph__hint">
        Parts flow left into the character they build · English names are WaniKani's · on'yomi in
        katakana, kun'yomi in hiragana · the parts draw first, then the kanji they build ·{' '}
        <b>click the centre</b> to replay ·{' '}
        <b>⌘ / Ctrl / Alt-click</b> any character for words and example sentences
      </p>
    </div>
  )
}

function Node({
  idx,
  node,
  x,
  y,
  isFocus = false,
  onPick,
  onVocab,
  delay,
  groups,
  runId,
  factor = 1,
  onReplay,
  spotlight,
}: {
  idx: KanjiIndex
  node: CompNode
  x: number
  y: number
  isFocus?: boolean
  onPick: (ch: string) => void
  onVocab: (ch: string, e: { clientX: number; clientY: number }) => void
  delay: number
  groups?: number[]
  runId: number
  factor?: number
  onReplay?: () => void
  /** 'lit' while this part is being written into the focus kanji, 'dim' for
   *  everything else during that moment */
  spotlight?: 'lit' | 'dim' | null
}) {
  const { ch, ghost, count, strokes } = node
  const k = idx.data.kanji[ch]
  const info = idx.data.components[ch]
  const { primary, secondary } = partName(idx, ch)
  const reading = partReadings(idx, ch)
  const dead = ghost || isUnrenderable(idx, ch)
  const kind = ghost
    ? 'tree__node--ghost'
    : k
      ? `tree__node--${k.l}`
      : info?.wkr
        ? 'tree__node--radical'
        : ''

  return (
    <g
      className={`tree__node ${kind} ${isFocus ? 'is-focus' : ''} ${dead ? 'is-dead' : ''} ${
        spotlight === 'lit' ? 'is-lit' : spotlight === 'dim' ? 'is-dim' : ''
      }`}
      transform={`translate(${x} ${y})`}
      onClick={(e) => {
        if (dead) return
        if (isVocabClick(e)) {
          e.preventDefault()
          onVocab(ch, e)
          return
        }
        if (isFocus) {
          onReplay?.()
          return
        }
        if (k) onPick(ch)
      }}
      // macOS treats Ctrl-click as a right-click; don't let the menu steal it
      onContextMenu={(e) => e.ctrlKey && e.preventDefault()}
    >
      <circle r={R} />
      {ghost ? (
        <>
          <text className="tree__ghostnum" y={5}>
            {strokes}
          </text>
          <text className="tree__meaning" y={R + 14}>
            unnamed strokes
          </text>
        </>
      ) : (
        <>
          <StrokePaths
            char={ch}
            size={isFocus ? 56 : 46}
            delay={delay}
            runId={runId}
            groups={groups}
            factor={factor}
            className={isFocus ? 'tree__ink tree__ink--focus' : 'tree__ink'}
          />
          <text className="tree__meaning" y={R + 14}>
            {primary}
          </text>
          {/* on'yomi in katakana, kun'yomi in hiragana — a pure radical has
              neither, so its bushu name takes the first line */}
          <text className="tree__on jp" y={R + 27}>
            {reading.on || secondary}
          </text>
          <text className="tree__kun jp" y={R + 39}>
            {reading.on && secondary && !reading.kun ? secondary : reading.kun}
          </text>
          {count > 1 && (
            <>
              <circle className="tree__mult" cx={R - 3} cy={-R + 3} r={11} />
              <text className="tree__multnum" x={R - 3} y={-R + 7}>
                ×{count}
              </text>
            </>
          )}
        </>
      )}
    </g>
  )
}
