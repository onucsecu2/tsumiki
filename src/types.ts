export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface Part {
  /** component character */
  e: string
  /** position hint from KanjiVG (left / right / top / bottom / enclose ...) */
  p: string
  /** stroke count of this part */
  n: number
}

export interface Kanji {
  c: string
  l: Level
  s: number
  g: number | null
  f: number | null
  m: string[]
  on: string[]
  kun: string[]
  d: Part[]
  comp: string[]
}

export interface Component {
  c: string
  /** canonical form, e.g. 氵 -> 水 */
  o?: string
  m?: string[]
  s?: number
  n: number
  /** bushu name in kana, e.g. さんずい */
  jp?: string
  /** radical meaning, e.g. "water" */
  en?: string
  /** classical radical number 1–214 */
  num?: number
}

export interface Dataset {
  kanji: Record<string, Kanji>
  components: Record<string, Component>
}

export type Strokes = Record<string, string[]>
