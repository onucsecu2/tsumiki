import { useMemo } from 'react'
import Glyph from '../components/Glyph'
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
      <svg
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
                return at ? { ...at, span: (depthOf.get(key) ?? n.depth + 1) - n.depth } : null
              })
              .filter(Boolean) as { x: number; y: number; span: number }[]
            if (!feeds.length) return null
            const top = Math.min(...feeds.map((f) => f.y), to.y)
            const bottom = Math.max(...feeds.map((f) => f.y), to.y)
            return (
              <g key={`m${n.key}`} className="tree__merge">
                {feeds.map((f, i) => {
                  const dir = Math.sign(to.y - f.y)
                  // A part more than one column away (木 feeds both 林 and 森)
                  // detours through a lane below the row, so the line doesn't
                  // run straight through the node sitting between them.
                  if (f.span > 1) {
                    const lane = f.y + LANE
                    return (
                      <path
                        key={i}
                        className="tree__long"
                        d={`M ${f.x} ${f.y + R} V ${lane - 14} Q ${f.x} ${lane} ${f.x + 14} ${lane} H ${busX - 14} Q ${busX} ${lane} ${busX} ${lane - 14} V ${to.y + 6}`}
                      />
                    )
                  }
                  const d =
                    Math.abs(f.y - to.y) < 1
                      ? `M ${f.x + R} ${f.y} H ${busX}`
                      : `M ${f.x + R} ${f.y} H ${busX - 16} Q ${busX} ${f.y} ${busX} ${f.y + dir * 16}`
                  return <path key={i} d={d} />
                })}
                {bottom - top > 1 && (
                  <line className="tree__bus" x1={busX} y1={top} x2={busX} y2={bottom} />
                )}
                <path
                  className="tree__out"
                  d={`M ${busX} ${to.y} H ${to.x - R - 9}`}
                  markerEnd="url(#arrow)"
                />
                {feeds.length > 1 && (
                  <>
                    <circle className="tree__plusdot" cx={busX} cy={to.y} r={11} />
                    <text className="tree__plussign" x={busX} y={to.y + 5}>
                      +
                    </text>
                  </>
                )}
              </g>
            )
          })}

        {built.map((b) => (
          <path
            key={`b${b.ch}`}
            className="tree__onward"
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
            />
            {/* the recipe sits beside the node, where nothing else competes */}
            <text className="tree__recipe jp" x={b.x + R + 12} y={b.y + 4}>
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
      <p className="graph__hint">
        Parts flow left into the character they build · English names are WaniKani's · on'yomi in
        katakana, kun'yomi in hiragana · a dashed circle is a radical, not a kanji on its own ·{' '}
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
}: {
  idx: KanjiIndex
  node: CompNode
  x: number
  y: number
  isFocus?: boolean
  onPick: (ch: string) => void
  onVocab: (ch: string, e: { clientX: number; clientY: number }) => void
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
      className={`tree__node ${kind} ${isFocus ? 'is-focus' : ''} ${dead ? 'is-dead' : ''}`}
      transform={`translate(${x} ${y})`}
      onClick={(e) => {
        if (dead) return
        if (isVocabClick(e)) {
          e.preventDefault()
          onVocab(ch, e)
          return
        }
        if (!isFocus && k) onPick(ch)
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
          {isFocus ? (
            <foreignObject x={-29} y={-29} width={58} height={58}>
              <div className="tree__glyph">
                <Glyph char={ch} size={56} mode="animate" />
              </div>
            </foreignObject>
          ) : (
            <text className="tree__char jp" y={11}>
              {ch}
            </text>
          )}
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
