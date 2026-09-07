import { useState } from 'react'
import { RELEASES } from '../changelog'
import type { ChangeKind } from '../changelog'

const LABEL: Record<ChangeKind, string> = { new: 'New', fix: 'Fixed', change: 'Changed' }

/** Release notes. The current version is open; the rest fold away. */
export default function Changelog({ onClose }: { onClose: () => void }) {
  const current = __APP_VERSION__
  const [open, setOpen] = useState<string | null>(RELEASES[0]?.version ?? null)

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panelbox panelbox--tall" role="dialog" aria-label="Release notes">
        <header className="panelbox__head">
          <h2>
            更新履歴 <small>What&apos;s new</small>
          </h2>
          <button className="vocab__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <ol className="rel">
          {RELEASES.map((r) => {
            const isOpen = open === r.version
            const isCurrent = r.version === current
            return (
              <li key={r.version} className={`rel__item ${isOpen ? 'is-open' : ''}`}>
                <button className="rel__head" onClick={() => setOpen(isOpen ? null : r.version)}>
                  <span className="rel__ver">v{r.version}</span>
                  {isCurrent && <span className="rel__now">current</span>}
                  <span className="rel__line">{r.headline}</span>
                  <time className="rel__date">{r.date}</time>
                  <span className="rel__chev" aria-hidden>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <ul className="rel__changes">
                    {r.changes.map((c, i) => (
                      <li key={i}>
                        <span className={`tag tag--${c.kind}`}>{LABEL[c.kind]}</span>
                        <span>{c.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>

        {!RELEASES.some((r) => r.version === current) && (
          <p className="panelbox__msg is-bad">
            Running v{current}, which has no entry in the changelog yet.
          </p>
        )}
      </div>
    </div>
  )
}
