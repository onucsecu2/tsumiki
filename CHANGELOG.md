# Changelog

## v1.3.0

The state of the app as of this tag.

**字形 Graph**
- **組み立て Build-up** — parts converge on the character they build, simple left to
  complex right. The tree draws itself in dependency order: parts write their own strokes
  first, each connector draws as its part finishes, the kanji goes last, one component at a
  time. While a component is being written its node lights up and the rest dim.
- `標準 1×` / `ゆっくり 0.25×` playback toggle, remembered.
- **仲間 Relatives** — the radial view, neighbours weighted by rare shared components.
- Parts carry WaniKani's name, the bushu name in kana, on'yomi in katakana and kun'yomi in
  hiragana. Every part is nameable or its decomposition isn't used.
- ⌘/Ctrl/Alt-click any character for the JLPT words that use it, with a real example
  sentence.

**練習 Practice** — meaning / reading / shape drills, look-alike distractors, Leitner SRS.

**書き取り Sheets** — なぞり tracing sheets, and 部首から: pick a root and write its whole
family from the English meanings, with an optional answer key.

**データ** — export/import as JSON (merge or replace), reset, storage stats.

Composition sources, in priority order: WaniKani → CJKVI-IDS → flattened IDS → KanjiVG,
taking the first candidate whose parts can all be named and drawn. 2,211 kanji (N5–N1);
N1 is in the data but off by default in the browser.

Optional AWS Cognito + Google sign-in lives on `feat/cognito-google-auth`, off by default.
