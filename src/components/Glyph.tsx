import { useEffect, useMemo, useRef, useState } from 'react'
import { loadStrokes } from '../data'

const cache = new Map<string, string[]>()
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function ensureStrokes() {
  if (!loading) {
    loading = loadStrokes().then((all) => {
      for (const [k, v] of Object.entries(all)) cache.set(k, v)
      listeners.forEach((fn) => fn())
    })
  }
  return loading
}

export function useStrokes(char: string): string[] | null {
  const [, force] = useState(0)
  useEffect(() => {
    if (cache.size) return
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    void ensureStrokes()
    return () => {
      listeners.delete(fn)
    }
  }, [])
  return cache.get(char) ?? null
}

interface Props {
  char: string
  size?: number
  mode?: 'static' | 'animate' | 'trace'
  showGrid?: boolean
  showNumbers?: boolean
  className?: string
}

/** Renders one kanji from KanjiVG stroke paths, optionally animating stroke order. */
export default function Glyph({
  char,
  size = 120,
  mode = 'static',
  showGrid = false,
  showNumbers = false,
  className,
}: Props) {
  const strokes = useStrokes(char)
  const [tick, setTick] = useState(0)
  const ref = useRef<SVGSVGElement>(null)
  const count = useMemo(() => strokes?.length ?? 0, [strokes])

  useEffect(() => {
    if (mode !== 'animate' || !ref.current || !strokes) return
    const paths = Array.from(ref.current.querySelectorAll<SVGPathElement>('path.stroke'))
    paths.forEach((p) => {
      const len = p.getTotalLength()
      p.style.transition = 'none'
      p.style.strokeDasharray = String(len)
      p.style.strokeDashoffset = String(len)
    })
    let cancelled = false
    let i = 0
    const step = () => {
      if (cancelled || i >= paths.length) return
      const p = paths[i]
      const len = p.getTotalLength()
      const dur = Math.max(90, Math.min(320, len * 1.7))
      p.style.transition = `stroke-dashoffset ${dur}ms linear`
      p.style.strokeDashoffset = '0'
      i += 1
      window.setTimeout(step, dur + 40)
    }
    const start = window.setTimeout(step, 120)
    return () => {
      cancelled = true
      window.clearTimeout(start)
    }
  }, [char, mode, strokes, tick, count])

  if (!strokes) {
    // Empty char = a blank practice box; unknown char = fall back to the font.
    if (!char) {
      return (
        <svg className={`glyph glyph--${mode} ${className ?? ''}`} viewBox="0 0 109 109" width={size} height={size} aria-hidden>
          {showGrid && (
            <g className="glyph__grid">
              <rect x="0.5" y="0.5" width="108" height="108" rx="2" />
              <line x1="54.5" y1="0" x2="54.5" y2="109" />
              <line x1="0" y1="54.5" x2="109" y2="54.5" />
            </g>
          )}
        </svg>
      )
    }
    return (
      <span className={className} style={{ fontSize: size * 0.82, lineHeight: 1 }}>
        {char}
      </span>
    )
  }

  return (
    <svg
      ref={ref}
      className={`glyph glyph--${mode} ${className ?? ''}`}
      viewBox="0 0 109 109"
      width={size}
      height={size}
      onClick={mode === 'animate' ? () => setTick((t) => t + 1) : undefined}
      role="img"
      aria-label={char}
    >
      {showGrid && (
        <g className="glyph__grid">
          <rect x="0.5" y="0.5" width="108" height="108" rx="2" />
          <line x1="54.5" y1="0" x2="54.5" y2="109" />
          <line x1="0" y1="54.5" x2="109" y2="54.5" />
        </g>
      )}
      <g className="glyph__strokes">
        {strokes.map((d, i) => (
          <path key={i} className="stroke" d={d} />
        ))}
      </g>
      {showNumbers && strokes.map((d, i) => <StrokeNumber key={i} d={d} n={i + 1} />)}
    </svg>
  )
}

function StrokeNumber({ d, n }: { d: string; n: number }) {
  const m = /^M\s*([\d.]+)[,\s]+([\d.]+)/.exec(d)
  if (!m) return null
  return (
    <text className="glyph__num" x={Number(m[1])} y={Number(m[2])}>
      {n}
    </text>
  )
}
