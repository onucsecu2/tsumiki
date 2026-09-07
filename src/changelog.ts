/**
 * The source of truth for release notes — for the in-app panel *and* for
 * CHANGELOG.md, which `npm run changelog` regenerates from this file so the two
 * can't drift.
 *
 * Newest first. `version` must match package.json for the current release.
 */

export type ChangeKind = 'new' | 'fix' | 'change'

export interface Change {
  kind: ChangeKind
  text: string
}

export interface Release {
  version: string
  /** ISO date */
  date: string
  /** one line on what the release is about */
  headline: string
  changes: Change[]
}

export const RELEASES: Release[] = [
  {
    version: '1.4.0',
    date: '2026-09-06',
    headline: 'Release notes, in the app.',
    changes: [
      {
        kind: 'new',
        text: 'Click the version next to the app name for what changed in this build and every one before it. A dot on the pill means you haven’t read the current one yet.',
      },
      {
        kind: 'change',
        text: 'CHANGELOG.md is now generated from the same notes the panel shows (npm run changelog), so the file and the app can’t disagree.',
      },
    ],
  },
  {
    version: '1.3.2',
    date: '2026-09-06',
    headline: 'The radical spotlight works properly.',
    changes: [
      {
        kind: 'fix',
        text: 'Only the last radical appeared highlighted while everything else stayed dimmed. The focus kanji was being looked up by character after node keys became paths, which collapsed every spotlight delay to zero — the whole sequence fired before the kanji began drawing.',
      },
      {
        kind: 'fix',
        text: 'For the same reason, the “builds into” column stopped waiting for the focus kanji to finish. It waits again.',
      },
      {
        kind: 'change',
        text: 'A stroke group that can’t be matched to a node now leaves the tree alone instead of dimming all of it. 漢 is written 氵|艹|口|夫 but drawn as 氵 + 𦰩; it now lights 氵, then 𦰩.',
      },
    ],
  },
  {
    version: '1.3.1',
    date: '2026-09-06',
    headline: 'No more doubled lines, and truer top-level splits.',
    changes: [
      {
        kind: 'fix',
        text: 'Doubled lines in the graph (国, and anything else reaching the same part at two depths). Every occurrence of a part is its own node now, so no arrow spans more than one column.',
      },
      {
        kind: 'change',
        text: '国 was 口 + 王 + 丶 — strokes that add up, but not a structure. It is 囗 + 玉, with the detail still there if you follow it down. The graph now prefers the coarsest split that accounts for the strokes.',
      },
      {
        kind: 'fix',
        text: '石 no longer claims to be just 口, and 鳥 no longer claims to be just 灬. A decomposition whose strokes don’t add up is rejected outright.',
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-09-06',
    headline: 'First tagged release.',
    changes: [
      {
        kind: 'new',
        text: '組み立て Build-up graph: parts converge on the character they build, drawing themselves in order — parts first, then the kanji, one component at a time. The component being written lights up while the rest dim.',
      },
      { kind: 'new', text: '標準 1× / ゆっくり 0.25× playback speed, remembered between sessions.' },
      {
        kind: 'new',
        text: '仲間 Relatives: the radial view, with neighbours weighted by rare shared components.',
      },
      {
        kind: 'new',
        text: 'Every part carries WaniKani’s name, the bushu name in kana, on’yomi in katakana and kun’yomi in hiragana — or its decomposition isn’t used.',
      },
      {
        kind: 'new',
        text: '⌘ / Ctrl / Alt-click any character for the JLPT words that use it, each with a real example sentence.',
      },
      {
        kind: 'new',
        text: '書き取り Sheets: なぞり tracing, and 部首から — pick a root and write its whole family from the English meanings, with an optional answer key.',
      },
      { kind: 'new', text: '練習 Practice: meaning, reading and shape drills with spaced repetition.' },
      { kind: 'new', text: 'データ panel: export and import your data as JSON, or reset it.' },
    ],
  },
]

export const LATEST = RELEASES[0].version
