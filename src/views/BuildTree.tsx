import { useMemo } from 'react'
import Glyph from '../components/Glyph'
import type { KanjiIndex } from '../data'
import type { Kanji } from '../types'
import { buildTree, nameLabel, radicalName } from '../derive'

const COL_W = 250
const ROW_H = 118
const R = 34

interface Props {
  idx: KanjiIndex
  focus: Kanji
  setFocus: (ch: string) => void
}

/** 日 ─(+九 きゅう)→ 旭 : simple on the left, one radical added per step. */
export default function BuildTree({ idx, focus, setFocus }: Props) {
  const tree = useMemo(() => buildTree(idx, focus), [idx, focus])

  const pos = useMemo(() => {
    const counts = new Map<number, number>()
    for (const n of tree.nodes) counts.set(n.col, (counts.get(n.col) ?? 0) + 1)
    const map = new Map<string, { x: number; y: number }>()
    for (const n of tree.nodes) {
      const total = counts.get(n.col) ?? 1
      map.set(n.ch, {
        x: n.col * COL_W,
        y: (n.row - (total - 1) / 2) * ROW_H,
      })
    }
    return map
  }, [tree])

  const bounds = useMemo(() => {
    const xs = [...pos.values()].map((p) => p.x)
    const ys = [...pos.values()].map((p) => p.y)
    const pad = 92
    const minX = Math.min(...xs, 0) - pad - 40
    const maxX = Math.max(...xs, 0) + pad + 40
    const minY = Math.min(...ys, 0) - pad
    const maxY = Math.max(...ys, 0) + pad
    return { minX, minY, w: maxX - minX, h: maxY - minY }
  }, [pos])

  const colTitle = (col: number) =>
    col < 0 ? 'built from' : col === 0 ? 'this kanji' : 'builds into'

  return (
    <div className="tree-wrap">
      <svg
        className="tree"
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="tree__arrowhead" />
          </marker>
        </defs>

        {tree.cols.map((col) => {
          const any = tree.nodes.find((n) => n.col === col)
          if (!any) return null
          return (
            <text key={`h${col}`} className="tree__coltitle" x={col * COL_W} y={bounds.minY + 26}>
              {colTitle(col)}
            </text>
          )
        })}

        {tree.edges.map((e, i) => {
          const a = pos.get(e.from)
          const b = pos.get(e.to)
          if (!a || !b) return null
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const sx = a.x + (dx / len) * R
          const sy = a.y + (dy / len) * R
          const ex = b.x - (dx / len) * (R + 9)
          const ey = b.y - (dy / len) * (R + 9)
          const mx = (sx + ex) / 2
          const my = (sy + ey) / 2
          const added = e.added.slice(0, 3)
          const names = added.map((c) => radicalName(idx, c))
          // One added piece gets its bushu name spelled out; several get listed.
          const jp = names.map((n) => n.jp || n.en).filter(Boolean).join('・')
          const en = added.length === 1 && names[0].en !== jp ? names[0].en : ''
          const chars = added.join('')
          const w = Math.max(84, 40 + chars.length * 19 + Math.max(jp.length * 6.4, en.length * 4.6))
          return (
            <g key={i} className="tree__edge">
              <path d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`} markerEnd="url(#arrow)" />
              <g transform={`translate(${mx} ${my})`}>
                <rect className="tree__chip" x={-w / 2} y={-19} width={w} height={38} rx={9} />
                <text className="tree__plus" x={-w / 2 + 12} y={5}>
                  +
                </text>
                <text className="tree__addchar jp" x={-w / 2 + 24} y={6} textAnchor="start">
                  {chars}
                </text>
                <text className="tree__addname" x={-w / 2 + 30 + chars.length * 19} y={en ? -2 : 4}>
                  {jp}
                </text>
                {en && (
                  <text className="tree__addname tree__addname--en" x={-w / 2 + 30 + chars.length * 19} y={10}>
                    {en}
                  </text>
                )}
              </g>
            </g>
          )
        })}

        {tree.nodes.map((n) => {
          const p = pos.get(n.ch)!
          const k = idx.data.kanji[n.ch]
          const isFocus = n.ch === focus.c
          return (
            <g
              key={n.ch}
              className={`tree__node ${isFocus ? 'is-focus' : ''} tree__node--${k?.l ?? 'N5'}`}
              transform={`translate(${p.x} ${p.y})`}
              onClick={() => !isFocus && setFocus(n.ch)}
            >
              <circle r={R} />
              {isFocus ? (
                <foreignObject x={-30} y={-30} width={60} height={60}>
                  <div className="tree__glyph">
                    <Glyph char={n.ch} size={58} mode="animate" />
                  </div>
                </foreignObject>
              ) : (
                <text className="tree__char jp" y={12}>
                  {n.ch}
                </text>
              )}
              <text className="tree__meaning" y={R + 15}>
                {k?.m[0] ?? ''}
              </text>
              <text className="tree__reading jp" y={R + 27}>
                {k?.on[0] ?? k?.kun[0] ?? ''}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="graph__hint">
        Each arrow adds one radical · left is simpler, right is more complex · click any kanji to
        walk the chain
      </p>
    </div>
  )
}

export function RadicalChip({ idx, ch }: { idx: KanjiIndex; ch: string }) {
  const n = radicalName(idx, ch)
  return <span title={nameLabel(n)}>{n.jp || n.en}</span>
}
