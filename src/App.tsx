import { useEffect, useState } from 'react'
import Explore from './views/Explore'
import Practice from './views/Practice'
import Sheets from './views/Sheets'
import { loadIndex } from './data'
import type { KanjiIndex } from './data'
import { useSheet } from './store'

type View = 'graph' | 'practice' | 'sheet'

const TABS: { id: View; label: string; sub: string }[] = [
  { id: 'graph', label: '字形', sub: 'Graph' },
  { id: 'practice', label: '練習', sub: 'Practice' },
  { id: 'sheet', label: '書き取り', sub: 'Sheets' },
]

function readHash(): { view: View; focus: string } {
  const [v, f] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/')
  const view = (['graph', 'practice', 'sheet'] as const).includes(v as View) ? (v as View) : 'graph'
  return { view, focus: f || '語' }
}

export default function App() {
  const [idx, setIdx] = useState<KanjiIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [{ view, focus }, setRoute] = useState(readHash)
  const { sheet } = useSheet()

  useEffect(() => {
    loadIndex().then(setIdx, (e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    const onHash = () => setRoute(readHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const go = (next: Partial<{ view: View; focus: string }>) => {
    const v = next.view ?? view
    const f = next.focus ?? focus
    location.hash = `/${v}/${encodeURIComponent(f)}`
    setRoute({ view: v, focus: f })
  }

  return (
    <div className="app">
      <header className="topbar no-print">
        <h1 className="brand">
          <span className="brand__mark">漢</span>
          <span>
            <b>Kanji Graph</b>
            <small>N5 → N2 by shape</small>
          </span>
        </h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${view === t.id ? 'is-on' : ''}`}
              onClick={() => go({ view: t.id })}
            >
              <b className="jp">{t.label}</b>
              <small>
                {t.sub}
                {t.id === 'sheet' && sheet.length ? ` (${sheet.length})` : ''}
              </small>
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {error && <p className="empty">Could not load kanji data: {error}</p>}
        {!idx && !error && <p className="empty">Loading kanji…</p>}
        {idx && view === 'graph' && (
          <Explore idx={idx} focus={focus} setFocus={(c) => go({ focus: c })} />
        )}
        {idx && view === 'practice' && (
          <Practice idx={idx} setFocus={(c) => go({ view: 'graph', focus: c })} />
        )}
        {idx && view === 'sheet' && (
          <Sheets idx={idx} setFocus={(c) => go({ view: 'graph', focus: c })} />
        )}
      </main>
    </div>
  )
}
