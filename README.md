# Kanji Graph — JLPT N5 → N2 by shape

A personal, no-auth kanji trainer inspired by kanji60s.com. Instead of drilling a flat
list, you walk a **graph of shared components**. The main view builds kanji up one radical
at a time — 日 ─(+九 きゅう)→ 旭, 日 ─(+寺 てら)→ 時 — with simple characters on the left and
complex ones on the right. Click any node to make it the new centre and keep walking.

## Views

| View | What it does |
| --- | --- |
| **字形 Graph** | Two ways of reading the same relationships, toggled at the top. **組み立て Build-up** — parts converge on the character they build, simple on the left, complex on the right: `{丆, 口} → 石`, then `{山, 石} → 岩`. Each node carries its WaniKani name, its on'yomi in katakana and its kun'yomi in hiragana. Repeats collapse into a multiplier (林 = 木 ×2) and a part that feeds two different merges detours through a lane below the row rather than crossing the node between them. **仲間 Relatives** — the radial view: focus kanji ringed by its radicals, relatives on the outside. Parts are labelled with WaniKani's name and the bushu name (氵 Tsunami · さんずい). |
| **語彙 Words** | ⌘ / Ctrl / Alt-click any character — in the graph, in the browser list, anywhere — for the JLPT words that use it: reading, English, and a real example sentence with the word highlighted. |
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
- **WaniKani**, via [ebieki](https://github.com/fasiha/ebieki)'s published dependency graph
  (`fasiha/obsidian-japanese-quizzer`) — WK's own decomposition of 2,093 kanji and its 490
  radicals. This is the *primary* structure source: WK keeps 漢 as 氵 + 𦰩 where KanjiVG
  flattens it to 氵 + 艹 + 口 + 夫. Radical names come from `baerrach/wanikani_exporter`
  plus `scripts/wknames_extra.py`, which fills the ~110 forms that dump is missing.
- **kanjium** (mifunetoshiro) — the 214 classical radicals with their Japanese bushu names.
- **[open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks)** (MIT) — JLPT
  N5–N1 vocabulary lists, 6,608 kanji-containing words after cleaning.
- **Tatoeba / the Tanaka Corpus** (CC BY 2.0 FR), via
  [mwhirls/tatoeba-json](https://github.com/mwhirls/tatoeba-json) — 146,957 Japanese sentences
  with English translations *and a word-level index*, so a sentence is matched to a headword
  rather than to a substring. This is the same corpus Jisho shows under its entries.
  `scripts/build-radical-names.py` turns that table into `scripts/radnames.json`; variant
  forms (氵 → さんずい, not みず) are hand-curated there because the source doesn't map them.

N1 kanji are in the data but **off by default** in the browser. They're there so build-up
chains never dead-end — 旭 is N1, and without it 日 ─+九→ 旭 can't be drawn. Tick the N1
chip to study them too.

`scripts/build-data.py` regenerates both files; it needs `kanji.json` from kanji-data and
an unpacked KanjiVG release in `kvg/`.

Attribution for KanjiVG, KANJIDIC2 and Tatoeba must be kept if this is ever published — all
three are share-alike or attribution licensed. The word card carries the attribution in its
footer; the rest belongs in this file.

`scripts/build-vocab.py` produces `public/data/vocab.json` (1.1 MB, 1,974 kanji, up to 8 words
each, loaded only when you first open a word card).

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

### How the composition is decided

`scripts/compose.py` writes one canonical `parts` array per kanji at build time, so the
graph and the detail panel can never disagree. In priority order:

1. **WaniKani's radical list**, when its strokes add up exactly. Pedagogically the best
   split (漢 = 氵 + 𦰩, 時 = 日 + 寺) and it matches what you study. WK also wins when its
   parts have no stroke data to check against but it agrees with IDS on how many pieces
   there are — that's what keeps 漢 from flattening. 1,338 kanji.
2. **CJKVI-IDS top-level operands**, when each is a real character. IDS is a *complete*
   decomposition by construction, so it needs no stroke check at all — this is what
   removed the "unnamed strokes" placeholders: 石 = 丆 + 口, 朝 = 𠦝 + 月, 森 = 木 + 林,
   回 = 囗 + 口. 681 kanji.
3. **IDS again**, with codepoint-less composite operands expanded one level (楽 = 丷 + 八 +
   白 + 木). 102 kanji.
4. **KanjiVG**, when its strokes add up. 11 kanji.

A character none of them decomposes is a leaf — you learn it whole (79 kanji: 日, 山, 母,
州, 乗 …). IDS lists such characters as themselves, which is the signal.

**There are no ghost inputs left.** The mechanism survives as a safety net (`Kanji.gap`) but
nothing triggers it: a shortfall of one stroke is a counting convention (芽 = 艹 3 + 牙 4
against an official 8), not a missing piece, and IDS closes every real gap.

The **仲間 Relatives** view uses a different algorithm (`src/data.ts`): link strength weights
**rare** shared components far above ubiquitous ones like 一 or 口, which is what keeps that
graph from turning into a hairball.
