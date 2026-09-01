import { useEffect, useMemo, useState } from 'react'
import Glyph from '../components/Glyph'
import { componentLabel, kanjiWithComponent, LEVELS, STUDY_LEVELS, neighbours, search } from '../data'
import BuildTree from './BuildTree'
import { positionLabel, radicalName } from '../derive'
import type { KanjiIndex } from '../data'
import type { Kanji, Level } from '../types'
import { useSheet } from '../store'

interface Node {
  ch: string
  x: number
  y: number
  r: number
  kind: 'component' | 'kanji'
  shared?: string[]
}

const R_INNER = 122
const R_OUTER = 258

/** Radial layout: components on an inner ring, related kanji clustered near the
 *  component they share with the focus. */
function layout(idx: KanjiIndex, focus: Kanji): { nodes: Node[]; links: [Node, Node][] } {
  const parts = focus.d.length ? focus.d.map((p) => p.e) : focus.comp.slice(0, 4)
  const comps = Array.from(new Set(parts)).slice(0, 6)
  const nbs = neighbours(idx, focus, 26)

  const compNodes = new Map<string, Node>()
  const step = (Math.PI * 2) / Math.max(comps.length, 1)
  const offset = -Math.PI / 2
  comps.forEach((c, i) => {
    const a = offset + i * step
    compNodes.set(c, {
      ch: c,
      x: Math.cos(a) * R_INNER,
      y: Math.sin(a) * R_INNER,
      r: 26,
      kind: 'component',
    })
  })

  // A neighbour hangs off the *rarest* component it shares, so branches stay
  // distinctive instead of everything piling onto a common radical.
  const rarity = (c: string) => idx.byComponent.get(c)?.length ?? 9999
  const buckets = new Map<string, typeof nbs>(comps.map((c) => [c, [] as typeof nbs]))
  for (const n of nbs) {
    const home = n.shared
      .filter((s) => compNodes.has(s))
      .sort((a, b) => rarity(a) - rarity(b))[0]
    if (home) buckets.get(home)!.push(n)
  }
  // even out: hand overflow from crowded branches to empty ones
  const perBranch = Math.max(2, Math.ceil(nbs.length / Math.max(comps.length, 1)))
  const overflow: typeof nbs = []
  for (const [c, list] of buckets) {
    if (list.length > perBranch) overflow.push(...list.splice(perBranch))
    else if (!list.length) buckets.set(c, list)
  }
  for (const n of overflow) {
    const target = [...buckets.entries()].sort((a, b) => a[1].length - b[1].length)[0]
    if (target && target[1].length < perBranch) target[1].push(n)
  }

  const nodes: Node[] = [...compNodes.values()]
  const links: [Node, Node][] = []
  const centre: Node = { ch: focus.c, x: 0, y: 0, r: 46, kind: 'kanji' }

  comps.forEach((c, i) => {
    const cn = compNodes.get(c)!
    links.push([centre, cn])
    const list = (buckets.get(c) ?? []).slice(0, 7)
    const a0 = offset + i * step
    const spread = Math.min(step * 0.86, 1.25)
    list.forEach((n, j) => {
      const a = a0 + (list.length === 1 ? 0 : (j / (list.length - 1) - 0.5) * spread)
      const rr = R_OUTER + (j % 2 ? 30 : 0)
      const node: Node = {
        ch: n.kanji.c,
        x: Math.cos(a) * rr,
        y: Math.sin(a) * rr,
        r: 25,
        kind: 'kanji',
        shared: n.shared,
      }
      nodes.push(node)
      links.push([cn, node])
    })
  })

  return { nodes: [centre, ...nodes], links }
}

interface Props {
  idx: KanjiIndex
  focus: string
  setFocus: (ch: string) => void
}

export default function Explore({ idx, focus, setFocus }: Props) {
  const [query, setQuery] = useState('')
  const [levels, setLevels] = useState<Set<Level>>(new Set(STUDY_LEVELS))
  const [pinnedComp, setPinnedComp] = useState<string | null>(null)
  const [mode, setMode] = useState<'build' | 'relatives'>('build')
  const { sheet, toggle } = useSheet()

  const kanji = idx.data.kanji[focus]
  const results = useMemo(() => search(idx, query, levels), [idx, query, levels])
  const graph = useMemo(() => (kanji ? layout(idx, kanji) : null), [idx, kanji])
  const family = useMemo(
    () => (pinnedComp ? kanjiWithComponent(idx, pinnedComp) : []),
    [idx, pinnedComp],
  )

  useEffect(() => setPinnedComp(null), [focus])

  if (!kanji)
    return (
      <p className="empty">
        <span className="jp" style={{ fontSize: 40 }}>
          {focus}
        </span>
        <br />
        isn't in the N5–N1 set.{' '}
        <button className="link" onClick={() => setFocus('日')}>
          start from 日
        </button>
      </p>
    )

  const toggleLevel = (l: Level) =>
    setLevels((prev) => {
      const next = new Set(prev)
      if (next.has(l) && next.size > 1) next.delete(l)
      else next.add(l)
      return next
    })

  return (
    <div className="explore">
      <aside className="panel panel--list">
        <input
          className="search"
          placeholder="Search meaning, reading or kanji…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
        <p className="muted small">{results.length} kanji</p>
        <div className="kanji-grid">
          {results.slice(0, 400).map((k) => (
            <button
              key={k.c}
              className={`cell cell--${k.l} ${k.c === focus ? 'is-focus' : ''}`}
              title={`${k.m[0] ?? ''} · ${k.l}`}
              onClick={() => setFocus(k.c)}
            >
              {k.c}
            </button>
          ))}
        </div>
      </aside>

      <section className="graph-wrap">
        <div className="mode-switch">
          <button className={mode === 'build' ? 'is-on' : ''} onClick={() => setMode('build')}>
            組み立て <small>Build-up</small>
          </button>
          <button className={mode === 'relatives' ? 'is-on' : ''} onClick={() => setMode('relatives')}>
            仲間 <small>Relatives</small>
          </button>
        </div>
        {mode === 'build' && <BuildTree idx={idx} focus={kanji} setFocus={setFocus} />}
        {mode === 'relatives' && graph && (
          <svg className="graph" viewBox="-360 -340 720 680" key={focus}>
            <g className="graph__links">
              {graph.links.map(([a, b], i) => (
                <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              ))}
            </g>
            {graph.nodes.map((n, i) =>
              n.ch === focus ? (
                <g key="focus" className="node node--focus">
                  <circle r={n.r + 26} />
                  <foreignObject x={-58} y={-58} width={116} height={116}>
                    <div className="node__glyph">
                      <Glyph char={n.ch} size={112} mode="animate" />
                    </div>
                  </foreignObject>
                </g>
              ) : (
                <g
                  key={n.ch + i}
                  className={`node node--${n.kind}`}
                  transform={`translate(${n.x} ${n.y})`}
                  onClick={() =>
                    n.kind === 'kanji' ? setFocus(n.ch) : setPinnedComp(n.ch === pinnedComp ? null : n.ch)
                  }
                >
                  <circle r={n.r} className={n.ch === pinnedComp ? 'is-pinned' : ''} />
                  <text className="node__char" y={n.r * 0.36}>
                    {n.ch}
                  </text>
                  {n.kind === 'component' && (
                    // Labels sit on the far side of the ring so they never
                    // collide with the focus glyph in the middle.
                    <>
                      <text className="node__label" y={n.y < 0 ? -(n.r + 18) : n.r + 15}>
                        {radicalName(idx, n.ch).jp || componentLabel(idx, n.ch)}
                      </text>
                      <text
                        className="node__label node__label--en"
                        y={n.y < 0 ? -(n.r + 7) : n.r + 27}
                      >
                        {radicalName(idx, n.ch).en}
                      </text>
                    </>
                  )}
                </g>
              ),
            )}
          </svg>
        )}
        {mode === 'relatives' && (
          <p className="graph__hint">
            Click a <b>radical</b> to see every kanji built from it · click a <b>kanji</b> to jump
            there · click the centre glyph to replay stroke order
          </p>
        )}
      </section>

      <aside className="panel panel--detail">
        <header className="detail__head">
          <div>
            <h2 className="detail__char">{kanji.c}</h2>
            <p className="detail__meanings">{kanji.m.join(', ') || '—'}</p>
          </div>
          <span className={`badge badge--${kanji.l}`}>{kanji.l}</span>
        </header>

        <dl className="kv">
          <div>
            <dt>On</dt>
            <dd className="jp">{kanji.on.join('、') || '—'}</dd>
          </div>
          <div>
            <dt>Kun</dt>
            <dd className="jp">{kanji.kun.join('、') || '—'}</dd>
          </div>
          <div>
            <dt>Strokes</dt>
            <dd>{kanji.s}</dd>
          </div>
          <div>
            <dt>Frequency</dt>
            <dd>{kanji.f ? `#${kanji.f}` : '—'}</dd>
          </div>
        </dl>

        <button className={`btn ${sheet.includes(kanji.c) ? 'btn--on' : ''}`} onClick={() => toggle(kanji.c)}>
          {sheet.includes(kanji.c) ? '✓ On writing sheet' : '+ Add to writing sheet'}
        </button>

        <h3 className="detail__sub">Built from</h3>
        {!kanji.d.length && !kanji.comp.length && (
          <p className="parts__base">
            A base character — nothing decomposes it further.
            {radicalName(idx, kanji.c).jp && (
              <>
                {' '}
                It is radical #{idx.data.components[kanji.c]?.num} ·{' '}
                <b className="jp">{radicalName(idx, kanji.c).jp}</b>.
              </>
            )}
          </p>
        )}
        <ul className="parts">
          {(kanji.d.length ? kanji.d : kanji.comp.map((e) => ({ e, p: '', n: 0 }))).map((p, i) => (
            <li key={p.e + i}>
              <button className="part" onClick={() => setPinnedComp(p.e)}>
                <Glyph char={p.e} size={40} />
                <span>
                  <b className="jp">
                    {p.e}
                    {radicalName(idx, p.e).jp && (
                      <i className="part__bushu">{radicalName(idx, p.e).jp}</i>
                    )}
                  </b>
                  <em>{radicalName(idx, p.e).en || componentLabel(idx, p.e) || 'component'}</em>
                  {p.p && <small>{positionLabel(p.p)}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <h3 className="detail__sub">Stroke order</h3>
        <div className="stroke-order">
          <Glyph char={kanji.c} size={140} mode="animate" showGrid showNumbers />
        </div>

        {pinnedComp && (
          <>
            <h3 className="detail__sub">
              Family of <span className="jp">{pinnedComp}</span>
              {radicalName(idx, pinnedComp).jp ? ` ${radicalName(idx, pinnedComp).jp}` : ''} ·{' '}
              {family.length}
            </h3>
            <div className="kanji-grid kanji-grid--tight">
              {family.map((k) => (
                <button key={k.c} className={`cell cell--${k.l}`} onClick={() => setFocus(k.c)}>
                  {k.c}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
