import { useEffect, useRef } from 'react'
import { useStrokes } from './Glyph'

/**
 * One character drawn as SVG stroke paths, in place, on a schedule the caller
 * controls. Unlike <Glyph> this is SVG-native (no foreignObject) and its timing
 * is fixed per stroke rather than proportional to stroke length, so a parent can
 * work out exactly when a character finishes and start the next one.
 */

export const STROKE_MS = 118
export const STROKE_GAP = 42
/** beat between one component of a kanji and the next */
export const GROUP_PAUSE = 210
/** a connector line drawing from a finished part toward its merge */
export const EDGE_MS = 230
/** a character with no stroke data just fades in */
export const FADE_MS = 260
/** leaves don't all start together */
export const LEAF_STAGGER = 130

/** Playback speed as a multiplier of wall-clock time: 1 = normal, 4 = quarter
 *  speed. Everything in the cascade scales by the same factor so the schedule
 *  the parent computes and the strokes a child draws stay in step. */
export function drawTime(strokes: number, groups = 1, factor = 1): number {
  if (!strokes) return FADE_MS * factor
  return (strokes * (STROKE_MS + STROKE_GAP) + Math.max(0, groups - 1) * GROUP_PAUSE) * factor
}

/** Where each component of a character starts, relative to the character's own
 *  start — used to light up the matching node while that part is being drawn. */
export function groupOffsets(groups: number[], factor = 1): number[] {
  const out: number[] = []
  let at = 0
  for (const count of groups) {
    out.push(at)
    at += count * (STROKE_MS + STROKE_GAP) * factor + GROUP_PAUSE * factor
  }
  return out
}

interface Props {
  char: string
  size: number
  /** ms from the start of the run */
  delay: number
  /** bump to replay */
  runId: number
  /** stroke counts per component, so 岩 lands as 山 then 石 */
  groups?: number[]
  /** 1 = normal, 4 = quarter speed */
  factor?: number
  className?: string
}

export default function StrokePaths({
  char,
  size,
  delay,
  runId,
  groups,
  factor = 1,
  className,
}: Props) {
  const strokes = useStrokes(char)
  const ref = useRef<SVGGElement>(null)
  const key = groups?.join(',') ?? ''

  useEffect(() => {
    const host = ref.current
    if (!host || !strokes?.length) return
    const paths = Array.from(host.querySelectorAll<SVGPathElement>('path'))
    for (const p of paths) {
      const len = p.getTotalLength()
      p.style.transition = 'none'
      p.style.strokeDasharray = String(len)
      p.style.strokeDashoffset = String(len)
    }
    void host.getBoundingClientRect() // flush, so the reset isn't animated

    const timers: number[] = []
    const sizes = groups?.length ? groups : [paths.length]
    const strokeMs = STROKE_MS * factor
    let at = delay
    let i = 0
    for (const [gi, count] of sizes.entries()) {
      for (let n = 0; n < count && i < paths.length; n++, i++) {
        const path = paths[i]
        timers.push(
          window.setTimeout(() => {
            path.style.transition = `stroke-dashoffset ${strokeMs}ms linear`
            path.style.strokeDashoffset = '0'
          }, at),
        )
        at += (STROKE_MS + STROKE_GAP) * factor
      }
      if (gi < sizes.length - 1) at += GROUP_PAUSE * factor
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
    // `groups` is a fresh array on every render; `key` is its stable identity.
    // Depending on the array itself would restart the draw on any re-render —
    // which is exactly what the spotlight causes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, delay, runId, strokes, key, factor])

  const scale = size / 109

  if (!strokes?.length) {
    // no KanjiVG entry for this shape — show the character and fade it in
    return (
      <text
        className={`strokes__fallback jp ${className ?? ''}`}
        y={size * 0.33}
        style={{
          fontSize: size * 0.86,
          animationDelay: `${delay}ms`,
          animationDuration: `${FADE_MS * factor}ms`,
        }}
        key={runId}
      >
        {char}
      </text>
    )
  }

  return (
    <g
      ref={ref}
      className={`strokes ${className ?? ''}`}
      transform={`translate(${-size / 2} ${-size / 2}) scale(${scale})`}
    >
      {strokes.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  )
}
