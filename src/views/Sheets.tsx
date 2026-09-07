import { useMemo, useState } from 'react'
import Glyph from '../components/Glyph'
import { LEVELS } from '../data'
import type { KanjiIndex } from '../data'
import type { Kanji, Level } from '../types'
import { commonRoots, familyOf, partName, partReadings } from '../derive'
import { ROOTS_KEY, usePersisted, useSheet } from '../store'

const TRACE_COUNT = 4


interface Props {
  idx: KanjiIndex
  setFocus: (ch: string) => void
}

type Mode = 'rows' | 'family'

export default function Sheets({ idx, setFocus }: Props) {
  const [mode, setMode] = useState<Mode>('rows')
  const [showGrid, setShowGrid] = useState(true)

  return (
    <div className="sheets">
      <div className="sheets__modes no-print">
        <button className={mode === 'rows' ? 'is-on' : ''} onClick={() => setMode('rows')}>
          なぞり <small>Tracing</small>
        </button>
        <button className={mode === 'family' ? 'is-on' : ''} onClick={() => setMode('family')}>
          部首から <small>From a root</small>
        </button>
      </div>
      {mode === 'rows' ? (
        <TracingSheet idx={idx} setFocus={setFocus} showGrid={showGrid} setShowGrid={setShowGrid} />
      ) : (
        <FamilySheet idx={idx} setFocus={setFocus} showGrid={showGrid} setShowGrid={setShowGrid} />
      )}
    </div>
  )
}

interface SubProps extends Props {
  showGrid: boolean
  setShowGrid: (v: boolean) => void
}

/* ── the original: trace the kanji, then write it from memory ───────────── */
function TracingSheet({ idx, setFocus, showGrid, setShowGrid }: SubProps) {
  const { sheet, setSheet } = useSheet()
  const [showNumbers, setShowNumbers] = useState(true)
  const [traces, setTraces] = useState(TRACE_COUNT)
  const [blanks, setBlanks] = useState(6)

  const rows = useMemo(() => sheet.map((c) => idx.data.kanji[c]).filter(Boolean), [sheet, idx])

  const fillLevel = (l: Level, n: number) =>
    setSheet(
      idx.all
        .filter((k) => k.l === l)
        .sort((a, b) => (a.f ?? 9999) - (b.f ?? 9999))
        .slice(0, n)
        .map((k) => k.c),
    )

  return (
    <>
      <div className="sheets__bar no-print">
        <div className="chips">
          {LEVELS.map((l) => (
            <button key={l} className={`chip chip--${l}`} onClick={() => fillLevel(l, 20)}>
              Load 20 × {l}
            </button>
          ))}
          <button className="chip" onClick={() => setSheet([])}>
            Clear
          </button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          grid
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={(e) => setShowNumbers(e.target.checked)}
          />
          stroke numbers
        </label>
        <label className="toggle">
          traces
          <input type="number" min={0} max={8} value={traces} onChange={(e) => setTraces(Number(e.target.value))} />
        </label>
        <label className="toggle">
          blanks
          <input type="number" min={0} max={14} value={blanks} onChange={(e) => setBlanks(Number(e.target.value))} />
        </label>
        <button className="btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      {!rows.length && (
        <p className="empty no-print">
          Nothing on the sheet yet — add kanji from the graph, or load a level above.
        </p>
      )}

      <div className="sheet-page">
        {rows.map((k) => (
          <div className="sheet-row" key={k.c}>
            <div className="sheet-row__head">
              <Glyph char={k.c} size={88} showGrid={showGrid} showNumbers={showNumbers} />
              <div className="sheet-row__meta">
                <b className="jp">{k.c}</b>
                <span>{k.m.join(', ')}</span>
                <small className="jp">
                  {k.on.join('、')} {k.kun.join('、')}
                </small>
                <small>
                  {[k.l, `${k.s} strokes`, k.d.map((p) => p.e).join(' + ')].filter(Boolean).join(' · ')}
                </small>
                <button className="link no-print" onClick={() => setFocus(k.c)}>
                  graph →
                </button>
              </div>
            </div>
            <div className="sheet-row__boxes">
              {Array.from({ length: traces }, (_, i) => (
                <div className="box" key={`t${i}`}>
                  <Glyph char={k.c} size={72} mode="trace" showGrid={showGrid} />
                </div>
              ))}
              {Array.from({ length: blanks }, (_, i) => (
                <div className="box" key={`b${i}`}>
                  <Glyph char="" size={72} mode="trace" showGrid={showGrid} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ── from a root: the family is blank, you write it from the meaning ────── */
function FamilySheet({ idx, setFocus, showGrid, setShowGrid }: SubProps) {
  const [roots, setRoots] = usePersisted<string[]>(ROOTS_KEY, ['日'])
  const [draft, setDraft] = useState('')
  const [boxes, setBoxes] = useState(3)
  const [perRoot, setPerRoot] = useState(12)
  const [levels, setLevels] = useState<Set<Level>>(new Set<Level>(['N5', 'N4', 'N3', 'N2']))
  const [strokeHint, setStrokeHint] = useState(true)
  const [answerKey, setAnswerKey] = useState(true)

  const suggestions = useMemo(() => commonRoots(idx, 8, 40), [idx])

  const families = useMemo(
    () =>
      roots.map((root) => ({
        root,
        items: familyOf(idx, root, 60).filter((k) => levels.has(k.l)).slice(0, perRoot),
      })),
    [roots, idx, levels, perRoot],
  )

  const add = (ch: string) => {
    const c = ch.trim().slice(0, 1)
    if (!c || roots.includes(c)) return
    setRoots([...roots, c])
    setDraft('')
  }

  const toggleLevel = (l: Level) =>
    setLevels((prev) => {
      const n = new Set(prev)
      if (n.has(l) && n.size > 1) n.delete(l)
      else n.add(l)
      return n
    })

  return (
    <>
      <div className="sheets__bar no-print">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add(draft)
          }}
        >
          <input
            className="search search--root jp"
            placeholder="root kanji or radical…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
        <div className="chips">
          {roots.map((r) => (
            <button
              key={r}
              className="chip chip--root is-on jp"
              onClick={() => setRoots(roots.filter((x) => x !== r))}
              title="remove"
            >
              {r} ✕
            </button>
          ))}
        </div>
        <div className="chips">
          {LEVELS.map((l) => (
            <button
              key={l}
              className={`chip chip--${l} ${levels.has(l) ? 'is-on' : ''}`}
              onClick={() => toggleLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="toggle">
          boxes
          <input type="number" min={1} max={8} value={boxes} onChange={(e) => setBoxes(Number(e.target.value))} />
        </label>
        <label className="toggle">
          per root
          <input type="number" min={1} max={30} value={perRoot} onChange={(e) => setPerRoot(Number(e.target.value))} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          grid
        </label>
        <label className="toggle">
          <input type="checkbox" checked={strokeHint} onChange={(e) => setStrokeHint(e.target.checked)} />
          stroke-count hint
        </label>
        <label className="toggle">
          <input type="checkbox" checked={answerKey} onChange={(e) => setAnswerKey(e.target.checked)} />
          answer key
        </label>
        <button className="btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="chips no-print roots__suggest">
        <span className="muted small">common roots:</span>
        {suggestions.map((r) => (
          <button key={r} className="chip jp" onClick={() => add(r)}>
            {r}
          </button>
        ))}
      </div>

      {!roots.length && <p className="empty no-print">Pick a root above to build a sheet.</p>}

      <div className="sheet-page">
        {families.map(({ root, items }) => (
          <Family
            key={root}
            idx={idx}
            root={root}
            items={items}
            boxes={boxes}
            showGrid={showGrid}
            strokeHint={strokeHint}
            answerKey={answerKey}
            setFocus={setFocus}
          />
        ))}
      </div>
    </>
  )
}

function Family({
  idx,
  root,
  items,
  boxes,
  showGrid,
  strokeHint,
  answerKey,
  setFocus,
}: {
  idx: KanjiIndex
  root: string
  items: Kanji[]
  boxes: number
  showGrid: boolean
  strokeHint: boolean
  answerKey: boolean
  setFocus: (ch: string) => void
}) {
  const name = partName(idx, root)
  const reading = partReadings(idx, root)

  return (
    <section className="family">
      <header className="family__head">
        <div className="family__rootbox">
          <Glyph char={root} size={80} showGrid={showGrid} />
        </div>
        <div className="family__rootmeta">
          <b className="jp">{root}</b>
          <span>{name.primary}</span>
          <small className="jp">
            {[reading.on, reading.kun, name.secondary].filter(Boolean).join(' · ')}
          </small>
          <small>{items.length} kanji built on it — write each one from its meaning</small>
        </div>
      </header>

      <ol className="family__items">
        {items.map((k, i) => (
          <li className="family__item" key={k.c}>
            <span className="family__num">{i + 1}</span>
            <div className="family__boxes">
              {Array.from({ length: boxes }, (_, b) => (
                <div className="box" key={b}>
                  <Glyph char="" size={66} mode="trace" showGrid={showGrid} />
                </div>
              ))}
            </div>
            <p className="family__clue">
              <span>{k.m.join(', ')}</span>
              <small>
                {[k.l, strokeHint ? `${k.s} strokes` : ''].filter(Boolean).join(' · ')}
              </small>
              <button className="link no-print" onClick={() => setFocus(k.c)}>
                graph →
              </button>
            </p>
          </li>
        ))}
      </ol>

      {answerKey && (
        <p className="family__key">
          <span>answers</span>
          {items.map((k, i) => (
            <span key={k.c} className="jp">
              {i + 1}. {k.c}
            </span>
          ))}
        </p>
      )}
    </section>
  )
}
