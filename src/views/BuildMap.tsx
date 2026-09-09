import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StrokePaths from '../components/StrokePaths'
import type { KanjiIndex } from '../data'
import { partReadings } from '../derive'
import { randomPuzzle } from '../buildMap'
import type { Puzzle, Slot } from '../buildMap'
import { grade, SRS_KEY, usePersisted } from '../store'
import type { SrsState } from '../store'
import { PHONE, useMedia } from '../useMedia'

const COL_W = 168
const ROW_H = 132
const R = 32

type SlotState = 'blank' | 'right' | 'wrong'

interface Props {
  idx: KanjiIndex
  setFocus: (ch: string) => void
}

/**
 * 組み立て練習 — the build-up map with the kanji removed. Radicals on the left
 * are printed; every kanji is a blank you type from its English meaning, in
 * whatever order you can work it out.
 */
export default function BuildMap({ idx, setFocus }: Props) {
  const phone = useMedia(PHONE)
  const [, setSrs] = usePersisted<SrsState>(SRS_KEY, {})
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [filled, setFilled] = useState<Record<string, string>>({})
  const [wrong, setWrong] = useState<Record<string, boolean>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [solved, setSolved] = useState(0)

  const next = useCallback(() => {
    setPuzzle(randomPuzzle(idx, puzzle?.target.c))
    setFilled({})
    setWrong({})
    setRevealed({})
  }, [idx, puzzle])

  useEffect(() => {
    if (!puzzle) setPuzzle(randomPuzzle(idx))
  }, [idx, puzzle])

  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    if (!puzzle) return m
    const mid = (puzzle.span - 1) / 2
    for (const n of puzzle.nodes) {
      m.set(n.key, { x: -n.depth * COL_W, y: (n.slot - mid) * ROW_H })
    }
    return m
  }, [puzzle])

  const view = useMemo(() => {
    const xs = [...pos.values()].map((p) => p.x)
    const ys = [...pos.values()].map((p) => p.y)
    if (!xs.length) return { minX: -300, minY: -160, w: 600, h: 320 }
    const padX = 118
    const padY = 96
    return {
      minX: Math.min(...xs) - padX,
      minY: Math.min(...ys) - padY,
      w: Math.max(...xs) - Math.min(...xs) + padX * 2,
      h: Math.max(...ys) - Math.min(...ys) + padY * 2,
    }
  }, [pos])

  const done = puzzle ? puzzle.nodes.every((n) => n.given || filled[n.key] || revealed[n.key]) : false
  const allCorrect = puzzle ? puzzle.nodes.every((n) => n.given || filled[n.key]) : false

  useEffect(() => {
    if (done && allCorrect) setSolved((s) => s + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, allCorrect])

  const answer = (node: Slot, typed: string) => {
    // an IME hands over whole characters; compare the last one entered
    const ch = [...typed.trim()].pop() ?? ''
    if (!ch) return
    if (ch === node.ch) {
      setFilled((f) => ({ ...f, [node.key]: ch }))
      setWrong((w) => ({ ...w, [node.key]: false }))
      setSrs((prev) => ({ ...prev, [node.ch]: grade(prev[node.ch], true) }))
    } else {
      setWrong((w) => ({ ...w, [node.key]: true }))
      setSrs((prev) => ({ ...prev, [node.ch]: grade(prev[node.ch], false) }))
      window.setTimeout(() => setWrong((w) => ({ ...w, [node.key]: false })), 700)
    }
  }

  if (!puzzle) return <p className="empty">Building a map…</p>

  const size = phone
    ? { width: Math.max(340, Math.round((360 * view.w) / view.h)), height: 360 }
    : {}

  return (
    <div className="bmap">
      <div className="bmap__bar">
        <span className="muted small">
          Type each kanji from its meaning · {puzzle.blanks} to fill · solved {solved}
        </span>
        <button className="chip" onClick={() => setRevealed(Object.fromEntries(puzzle.nodes.map((n) => [n.key, true])))}>
          Reveal all
        </button>
        <button className="btn bmap__next" onClick={next}>
          New map →
        </button>
      </div>

      <div className="bmap__scroll">
        <svg
          className="bmap__svg"
          viewBox={`${view.minX} ${view.minY} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          {...size}
        >
          <defs>
            <marker id="bm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="tree__arrowhead" />
            </marker>
          </defs>

          {puzzle.links.map((l, i) => {
            const a = pos.get(l.from)
            const b = pos.get(l.to)
            if (!a || !b) return null
            const midX = (a.x + b.x) / 2
            return (
              <path
                key={i}
                className="bmap__link"
                d={`M ${a.x + R} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x - R - 8} ${b.y}`}
                markerEnd="url(#bm-arrow)"
              />
            )
          })}

          {puzzle.nodes.map((n) => {
            const at = pos.get(n.key)!
            const state: SlotState = filled[n.key] ? 'right' : wrong[n.key] ? 'wrong' : 'blank'
            const shown = filled[n.key] ?? (revealed[n.key] ? n.ch : '')
            const level = idx.data.kanji[n.ch]?.l
            return (
              <g
                key={n.key}
                className={`bmap__node is-${state} ${n.given ? 'is-given' : ''} ${
                  revealed[n.key] && !filled[n.key] ? 'is-revealed' : ''
                } ${level ? `tree__node--${level}` : ''}`}
                transform={`translate(${at.x} ${at.y})`}
              >
                <circle r={R} />
                {n.given || shown ? (
                  <StrokePaths
                    char={n.given ? n.ch : shown}
                    size={46}
                    delay={0}
                    runId={shown ? 1 : 0}
                    className="tree__ink"
                  />
                ) : (
                  <text className="bmap__qmark" y={11}>
                    ?
                  </text>
                )}
                <text className="bmap__clue" y={R + 15}>
                  {n.clue}
                </text>
                {!n.given && (
                  <text className="bmap__strokes" y={R + 27}>
                    {n.strokes} strokes
                  </text>
                )}
                {n.given && (
                  <text className="bmap__strokes jp" y={R + 27}>
                    {partReadings(idx, n.ch).on || ''}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="bmap__inputs">
        {puzzle.nodes
          .filter((n) => !n.given)
          .sort((a, b) => b.depth - a.depth || a.slot - b.slot)
          .map((n) => (
            <SlotInput
              key={n.key}
              node={n}
              value={filled[n.key] ?? (revealed[n.key] ? n.ch : '')}
              locked={Boolean(filled[n.key] || revealed[n.key])}
              wrong={Boolean(wrong[n.key])}
              onAnswer={(v) => answer(n, v)}
              onReveal={() => setRevealed((r) => ({ ...r, [n.key]: true }))}
            />
          ))}
      </div>

      {done && (
        <div className={`bmap__done ${allCorrect ? 'is-win' : ''}`}>
          <span className="jp">{puzzle.target.c}</span>
          <div>
            <b>{allCorrect ? 'Complete' : 'Revealed'}</b>
            <small>
              {puzzle.target.m.join(', ')} · {puzzle.target.l}
            </small>
          </div>
          <button className="link" onClick={() => setFocus(puzzle.target.c)}>
            open in graph →
          </button>
          <button className="btn bmap__next" onClick={next}>
            New map →
          </button>
        </div>
      )}
    </div>
  )
}

function SlotInput({
  node,
  value,
  locked,
  wrong,
  onAnswer,
  onReveal,
}: {
  node: Slot
  value: string
  locked: boolean
  wrong: boolean
  onAnswer: (v: string) => void
  onReveal: () => void
}) {
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div className={`slot ${locked ? 'is-locked' : ''} ${wrong ? 'is-wrong' : ''}`}>
      <label className="slot__clue">{node.clue}</label>
      <div className="slot__row">
        <input
          ref={ref}
          className="slot__input jp"
          value={locked ? value : draft}
          readOnly={locked}
          placeholder="漢字"
          lang="ja"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value)
            // an IME commits a whole character, so check as it arrives
            if ([...e.target.value].length) onAnswer(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAnswer(draft)
          }}
        />
        {!locked && (
          <button className="slot__hint" onClick={onReveal} title="Show this one">
            ?
          </button>
        )}
      </div>
      <small className="slot__meta">{node.strokes} strokes</small>
    </div>
  )
}
