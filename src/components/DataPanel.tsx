import { useRef, useState } from 'react'
import { exportData, importData, resetData, storeStats } from '../store'
import type { ImportMode } from '../store'

/** Everything the app remembers lives in this browser. This is how you move
 *  it somewhere else, or throw it away. */
export default function DataPanel({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState(storeStats)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [armed, setArmed] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const mode = useRef<ImportMode>('merge')

  const refresh = () => setStats(storeStats())

  const download = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tsumiki-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setNote({ ok: true, text: 'Exported.' })
  }

  const pick = (m: ImportMode) => {
    mode.current = m
    file.current?.click()
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const result = importData(JSON.parse(await f.text()), mode.current)
      setNote({ ok: result.ok, text: result.message })
      refresh()
    } catch {
      setNote({ ok: false, text: "Couldn't read that file as JSON." })
    }
  }

  const empty = !stats.sheet && !stats.roots && !stats.srs

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panelbox" role="dialog" aria-label="Saved data">
        <header className="panelbox__head">
          <h2>
            データ <small>Saved data</small>
          </h2>
          <button className="vocab__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <dl className="kv kv--wide">
          <div>
            <dt>Writing sheet</dt>
            <dd>{stats.sheet} kanji</dd>
          </div>
          <div>
            <dt>Sheet roots</dt>
            <dd>{stats.roots}</dd>
          </div>
          <div>
            <dt>Practice cards</dt>
            <dd>{stats.srs}</dd>
          </div>
          <div>
            <dt>Learned</dt>
            <dd>{stats.learned}</dd>
          </div>
        </dl>

        <p className="panelbox__note">
          All of it lives in this browser only — nothing is sent anywhere. Clearing site data
          wipes it, so export before you reinstall or switch machines.
        </p>

        <div className="panelbox__actions">
          <button className="btn" onClick={download} disabled={empty}>
            Export JSON
          </button>
          <button className="btn" onClick={() => pick('merge')}>
            Import & merge
          </button>
          <button className="btn" onClick={() => pick('replace')}>
            Import & replace
          </button>
        </div>
        <p className="panelbox__hint">
          <b>Merge</b> keeps whichever practice card is further along, so two machines can be
          combined safely. <b>Replace</b> overwrites what's here with the file.
        </p>

        <div className="panelbox__danger">
          {!armed ? (
            <button className="btn btn--danger" onClick={() => setArmed(true)} disabled={empty}>
              Reset all saved data
            </button>
          ) : (
            <>
              <span>Delete the writing sheet, the roots and all practice progress?</span>
              <button
                className="btn btn--danger"
                onClick={() => {
                  resetData()
                  setArmed(false)
                  refresh()
                  setNote({ ok: true, text: 'Everything cleared.' })
                }}
              >
                Yes, reset
              </button>
              <button className="btn" onClick={() => setArmed(false)}>
                Cancel
              </button>
            </>
          )}
        </div>

        {note && <p className={`panelbox__msg ${note.ok ? 'is-ok' : 'is-bad'}`}>{note.text}</p>}

        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          hidden
        />
      </div>
    </div>
  )
}
