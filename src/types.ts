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
  /** WaniKani's decomposition, when it knows this kanji. Preferred over `d`:
   *  WK keeps 漢 as 氵+𦰩 where KanjiVG flattens it to 氵+艹+口+夫. */
  wk?: string[]
  /** The canonical composition, decided at build time by scripts/compose.py.
   *  Repeats are explicit (林 = 木, 木). Empty for characters you learn whole. */
  parts?: string[]
  /** WaniKani teaches this character as a radical in its own right (石, 山). */
  atom?: boolean
  /** strokes the listed parts don't account for — drawn as one ghost input */
  gap?: number
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
  /** WaniKani's mnemonic name, e.g. Tsunami for 氵 */
  wk?: string
  /** WaniKani level this radical is taught at */
  wkl?: number
  /** WaniKani treats this shape as a radical in its own right */
  wkr?: boolean
  /** an IDS description (⿰⿱…), not a real character — cannot be rendered */
  ids?: boolean
}

export interface Dataset {
  kanji: Record<string, Kanji>
  components: Record<string, Component>
}

export type Strokes = Record<string, string[]>

export interface Sentence {
  jp: string
  en: string
}

/** A word that uses a given kanji, with an example of it in use. */
export interface VocabEntry {
  /** the word as written */
  w: string
  /** reading in kana */
  r: string
  /** English gloss */
  m: string
  l: Level
  s?: Sentence
}

export type VocabIndex = Record<string, VocabEntry[]>
