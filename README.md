# Kanji Graph — JLPT N5 → N2 by shape

A personal, no-auth kanji trainer inspired by kanji60s.com. Instead of drilling a flat
list, you walk a **graph of shared components**. The main view builds kanji up one radical
at a time — 日 ─(+九 きゅう)→ 旭, 日 ─(+寺 てら)→ 時 — with simple characters on the left and
complex ones on the right. Click any node to make it the new centre and keep walking.

## Views

| View | What it does |
| --- | --- |
| **字形 Graph** | Two ways of reading the same relationships, toggled at the top: **組み立て Build-up** — a left→right derivation tree, simple to complex, one radical added per arrow (日 ─+九 きゅう→ 旭). **仲間 Relatives** — the radial view: focus kanji ringed by its radicals, relatives on the outside. Both label radicals with their bushu name (さんずい · water). |
| **練習 Practice** | Multiple-choice drills (kanji→meaning, kanji→reading, meaning→kanji) with look-alike distractors and Leitner spaced repetition in `localStorage`. Keys `1`–`4`. |
| **書き取り Sheets** | Printable practice sheets — tracing outlines + blank genkouyoushi boxes. `Print / Save as PDF`. |

State (writing sheet, SRS progress) lives in `localStorage`. No accounts, no server.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Data

`public/data/kanji.json` (2211 kanji, N5–N1) and `public/data/strokes.json` are generated
from:

- **KanjiVG** (Ulrich Apel) — stroke paths *and* the component tree that drives the graph.
  CC BY-SA 3.0.
- **kanji-data** (davidluzgouveia) — meanings, on/kun readings, JLPT level, frequency,
  derived from KANJIDIC2 (EDRDG, CC BY-SA 4.0) and WaniKani.
- **kanjium** (mifunetoshiro) — the 214 classical radicals with their Japanese bushu names.
  `scripts/build-radical-names.py` turns that table into `scripts/radnames.json`; variant
  forms (氵 → さんずい, not みず) are hand-curated there because the source doesn't map them.

N1 kanji are in the data but **off by default** in the browser. They're there so build-up
chains never dead-end — 旭 is N1, and without it 日 ─+九→ 旭 can't be drawn. Tick the N1
chip to study them too.

`scripts/build-data.py` regenerates both files; it needs `kanji.json` from kanji-data and
an unpacked KanjiVG release in `kvg/`.

Attribution for KanjiVG and KANJIDIC2 must be kept if this is ever published.

## Shape of the data

```jsonc
"時": {
  "c": "時", "l": "N5", "s": 10, "f": 16,
  "m": ["Time", "O'clock", "Hour"],
  "on": ["じ"], "kun": ["とき", "-どき"],
  "d":    [{ "e": "日", "p": "left", "n": 4 }, { "e": "寺", "p": "right", "n": 6 }],
  "comp": ["日", "寺", "土", "寸"]
}
```

`d` is the top-level decomposition (used for the inner ring); `comp` is every component in
the tree (used to find relatives).

Two different algorithms read that data, in `src/derive.ts` and `src/data.ts`:

- **Build-up** (`derive.ts`): A is a parent of B when A is a kanji inside B's component
  tree and A has fewer strokes. The arrow label is `comp(B) − comp(A) − {A}`, reduced so
  pieces contained in other pieces drop out — that's why 日 → 時 reads `+寺`, not
  `+寺 +土 +寸`. Everything sorts on fixed keys (added-count, JLPT, frequency, codepoint),
  so a kanji always draws the identical tree.
- **Relatives** (`data.ts`): link strength weights **rare** shared components far above
  ubiquitous ones like 一 or 口, which is what keeps that graph from turning into a hairball.
