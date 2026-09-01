import { useCallback, useEffect, useMemo, useState } from 'react'
import Glyph from '../components/Glyph'
import { LEVELS } from '../data'
import type { KanjiIndex } from '../data'
import type { Kanji, Level } from '../types'
import { grade, isDue, SRS_KEY, usePersisted } from '../store'
import type { SrsState } from '../store'

type Mode = 'meaning' | 'reading' | 'shape'

const MODE_LABEL: Record<Mode, string> = {
  meaning: 'Kanji → meaning',
  reading: 'Kanji → reading',
  shape: 'Meaning → kanji',
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Question {
  target: Kanji
  options: Kanji[]
}

function buildQuestion(pool: Kanji[], target: Kanji, mode: Mode): Question {
  // Distractors that look or sound similar make the drill actually teach something.
  const similar = pool
    .filter((k) => k.c !== target.c)
    .map((k) => {
      const shared = k.comp.filter((c) => target.comp.includes(c)).length
      const strokeGap = Math.abs(k.s - target.s)
      const sound =
        mode === 'reading' && k.on.some((r) => target.on.some((t) => t[0] === r[0])) ? 1 : 0
      return { k, score: shared * 3 + sound * 2 - strokeGap * 0.2 + Math.random() }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.k)
  return { target, options: shuffle([target, ...similar]) }
}

interface Props {
  idx: KanjiIndex
  setFocus: (ch: string) => void
}

export default function Practice({ idx, setFocus }: Props) {
  const [levels, setLevels] = useState<Set<Level>>(new Set<Level>(['N5']))
  const [mode, setMode] = useState<Mode>('meaning')
  const [srs, setSrs] = usePersisted<SrsState>(SRS_KEY, {})
  const [q, setQ] = useState<Question | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)

  const pool = useMemo(
    () => idx.all.filter((k) => levels.has(k.l) && (mode !== 'reading' || k.on.length || k.kun.length)),
    [idx, levels, mode],
  )

  const next = useCallback(() => {
    if (!pool.length) return setQ(null)
    const due = pool.filter((k) => isDue(srs[k.c]))
    const bag = due.length ? due : pool
    const target = bag[Math.floor(Math.random() * bag.length)]
    setPicked(null)
    setQ(buildQuestion(pool, target, mode))
  }, [pool, mode, srs])

  useEffect(() => {
    setPicked(null)
    setQ(pool.length ? buildQuestion(pool, pool[Math.floor(Math.random() * pool.length)], mode) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, mode])

  const answer = (choice: Kanji) => {
    if (picked || !q) return
    const correct = choice.c === q.target.c
    setPicked(choice.c)
    setStreak((s) => (correct ? s + 1 : 0))
    setSrs((prev) => ({ ...prev, [q.target.c]: grade(prev[q.target.c], correct) }))
    window.setTimeout(next, correct ? 620 : 1600)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q) return
      if (e.key >= '1' && e.key <= '4') {
        const o = q.options[Number(e.key) - 1]
        if (o) answer(o)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (picked) next()
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const stats = useMemo(() => {
    const cards = pool.map((k) => srs[k.c]).filter(Boolean)
    const learned = cards.filter((c) => c.box >= 3).length
    return { seen: cards.length, learned, total: pool.length }
  }, [pool, srs])

  const toggleLevel = (l: Level) =>
    setLevels((prev) => {
      const n = new Set(prev)
      if (n.has(l) && n.size > 1) n.delete(l)
      else n.add(l)
      return n
    })

  return (
    <div className="practice">
      <div className="practice__bar">
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
        <div className="chips">
          {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
            <button key={m} className={`chip ${mode === m ? 'is-on' : ''}`} onClick={() => setMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="muted small">
          streak {streak} · {stats.learned}/{stats.total} learned · {stats.seen} seen · keys 1–4
        </p>
      </div>

      {!q && <p className="empty">Pick at least one level.</p>}

      {q && (
        <div className="card">
          <div className="card__prompt">
            {mode === 'shape' ? (
              <p className="prompt-text">{q.target.m.join(', ')}</p>
            ) : (
              <Glyph char={q.target.c} size={190} />
            )}
          </div>

          <div className="options">
            {q.options.map((o, i) => {
              const state = !picked
                ? ''
                : o.c === q.target.c
                  ? 'is-correct'
                  : o.c === picked
                    ? 'is-wrong'
                    : 'is-dim'
              return (
                <button key={o.c} className={`option ${state}`} onClick={() => answer(o)}>
                  <span className="kbd">{i + 1}</span>
                  {mode === 'meaning' && <span className="option__text">{o.m.join(', ') || '—'}</span>}
                  {mode === 'reading' && (
                    <span className="option__text jp">
                      {(o.on[0] ? o.on[0] : o.kun[0]) ?? '—'}
                    </span>
                  )}
                  {mode === 'shape' && <span className="option__kanji">{o.c}</span>}
                </button>
              )
            })}
          </div>

          {picked && (
            <div className="reveal">
              <button className="link" onClick={() => setFocus(q.target.c)}>
                {q.target.c} — {q.target.m.join(', ')} · {q.target.on.join('、')}{' '}
                {q.target.kun.join('、')} → open in graph
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
