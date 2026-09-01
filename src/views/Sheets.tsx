import { useMemo, useState } from 'react'
import Glyph from '../components/Glyph'
import { LEVELS } from '../data'
import type { KanjiIndex } from '../data'
import type { Level } from '../types'
import { useSheet } from '../store'

const TRACE_COUNT = 4

interface Props {
  idx: KanjiIndex
  setFocus: (ch: string) => void
}

export default function Sheets({ idx, setFocus }: Props) {
  const { sheet, setSheet } = useSheet()
  const [showGrid, setShowGrid] = useState(true)
  const [showNumbers, setShowNumbers] = useState(true)
  const [traces, setTraces] = useState(TRACE_COUNT)
  const [blanks, setBlanks] = useState(6)

  const rows = useMemo(
    () => sheet.map((c) => idx.data.kanji[c]).filter(Boolean),
    [sheet, idx],
  )

  const fillLevel = (l: Level, n: number) =>
    setSheet(
      idx.all
        .filter((k) => k.l === l)
        .sort((a, b) => (a.f ?? 9999) - (b.f ?? 9999))
        .slice(0, n)
        .map((k) => k.c),
    )

  return (
    <div className="sheets">
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
          <input
            type="number"
            min={0}
            max={8}
            value={traces}
            onChange={(e) => setTraces(Number(e.target.value))}
          />
        </label>
        <label className="toggle">
          blanks
          <input
            type="number"
            min={0}
            max={14}
            value={blanks}
            onChange={(e) => setBlanks(Number(e.target.value))}
          />
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
                  {[k.l, `${k.s} strokes`, k.d.map((p) => p.e).join(' + ')]
                    .filter(Boolean)
                    .join(' · ')}
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
    </div>
  )
}
