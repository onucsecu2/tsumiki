import { useEffect, useRef, useState } from 'react'
import { loadVocab } from '../data'
import type { VocabEntry } from '../types'

export interface VocabAnchor {
  ch: string
  x: number
  y: number
}

interface Props {
  anchor: VocabAnchor
  onClose: () => void
  onOpenKanji?: (ch: string) => void
}

const W = 380
const MARGIN = 12
const GAP = 16

/** Words that use a kanji, each with one real sentence. Opened by
 *  ⌘/Ctrl/Alt-clicking a character anywhere in the app. */
export default function VocabCard({ anchor, onClose, onOpenKanji }: Props) {
  const [entries, setEntries] = useState<VocabEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    setEntries(null)
    setFailed(false)
    loadVocab().then(
      (v) => live && setEntries(v[anchor.ch] ?? []),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [anchor.ch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose()
    }
    addEventListener('keydown', onKey)
    // defer, or the click that opened the card closes it again
    const t = window.setTimeout(() => addEventListener('mousedown', onDown), 0)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('mousedown', onDown)
      window.clearTimeout(t)
    }
  }, [onClose])

  // Open on whichever side has more room, and never taller than that room.
  const left = Math.min(Math.max(MARGIN, anchor.x - W / 2), innerWidth - W - MARGIN)
  const below = innerHeight - anchor.y - GAP - MARGIN
  const above = anchor.y - GAP - MARGIN
  const flip = above > below
  const style: React.CSSProperties = {
    left,
    width: W,
    maxHeight: Math.max(200, Math.min(620, flip ? above : below)),
    ...(flip ? { bottom: innerHeight - anchor.y + GAP } : { top: anchor.y + GAP }),
  }

  return (
    <div className="vocab" style={style} ref={box} role="dialog" aria-label={`Words using ${anchor.ch}`}>
      <header className="vocab__head">
        <span className="vocab__char jp">{anchor.ch}</span>
        <span className="vocab__title">words using this kanji</span>
        <button className="vocab__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      {failed && <p className="vocab__empty">Couldn't load the word list.</p>}
      {!entries && !failed && <p className="vocab__empty">Loading…</p>}
      {entries?.length === 0 && (
        <p className="vocab__empty">No JLPT word in the list uses this character.</p>
      )}

      <ul className="vocab__list">
        {entries?.map((e) => (
          <li key={e.w} className="vocab__item">
            <div className="vocab__word">
              <b className="jp">{e.w}</b>
              {e.r && <span className="jp vocab__reading">{e.r}</span>}
              <span className={`badge badge--${e.l}`}>{e.l}</span>
            </div>
            <p className="vocab__gloss">{e.m}</p>
            {e.s && (
              <blockquote className="vocab__sentence">
                <span className="jp">{highlight(e.s.jp, e.w)}</span>
                <em>{e.s.en}</em>
              </blockquote>
            )}
          </li>
        ))}
      </ul>

      <footer className="vocab__foot">
        <span>
          words: JLPT lists (MIT) · sentences: Tatoeba / Tanaka Corpus (CC BY)
        </span>
        {onOpenKanji && (
          <button className="link" onClick={() => onOpenKanji(anchor.ch)}>
            open {anchor.ch} →
          </button>
        )}
      </footer>
    </div>
  )
}

/** Mark the word inside its sentence so the eye lands on it first. */
function highlight(sentence: string, word: string) {
  const at = sentence.indexOf(word)
  if (at < 0) return sentence
  return (
    <>
      {sentence.slice(0, at)}
      <mark>{word}</mark>
      {sentence.slice(at + word.length)}
    </>
  )
}
