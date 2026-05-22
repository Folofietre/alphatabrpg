# Plan — Instrument-aware character & track auto-selection (Phase 1)

> Status: draft / future work
> Date: 2026-05-21
> Scope: Guitar, Bass, Piano. **Drums are tracked separately** — see [2026-05-21-drums-support.md](./2026-05-21-drums-support.md).

## Goal

At character creation, the player picks an instrument: **Guitar**, **Bass**, or **Piano**. The choice is **permanent for that character** — switching will come later as a "Prestige" mechanic (out of scope here).

When a score is loaded, alphaTab renders the track matching the player's instrument. Scores with no compatible track are **hidden from the TabLibrary entirely** (no fallback picker, no "play anyway").

### Design intent

- **Piano = the classic, accessible experience.** Piano players see the broadest repertoire because they can also play guitar tracks when no piano track is present.
- **Guitar and Bass = thematic flavor.** They only play their own track family. No numeric bonus or penalty — the constraint is the flavor.

This trades a bit of grindability (a bassist sees fewer scores than a pianist) for character identity.

---

## What AlphaTab gives us

Each `Track` exposes:

- `track.playbackInfo.program` — MIDI GM program 0–127
- `track.playbackInfo.primaryChannel` — MIDI channel (9 = drums in GM)
- `track.isPercussion` — derived flag

MIDI program detection table for Phase 1:

| Instrument | Detection |
|---|---|
| Piano | `program` in 0..7 (Acoustic Grand → Clavinet, GM piano family) |
| Guitar | `program` in 24..31 |
| Bass | `program` in 32..39 |

Heuristic fallback for badly tagged scores: inspect `track.staves[*]` for TAB presence and note range. Probably not needed for v1 — accept that ill-tagged scores won't appear and tell the user to fix their tags.

---

## Track matching rules

| Player instrument | Tracks accepted | Fallback |
|---|---|---|
| Guitar | first guitar track | none |
| Bass | first bass track | none |
| Piano | first piano track | first guitar track (if no piano) |

If no rule matches, the score is invisible to that character.

---

## Data model

- Save schema bumped to `alphatab_rpg_save_v4`.
- `character.instrument: 'guitar' | 'bass' | 'piano'` — set at creation, **never changed afterwards** (no setter exposed by the store).
- Migration v3 → v4: default to `'piano'` (most permissive, lowest user surprise).

---

## Files

### `src/stores/character.js`
- Add `instrument` and `avatar` (derived from instrument, e.g. `'piano.png'`) to `defaultCharacter()`.
- New action `createCharacter({ name, instrument })` — only callable when `instrument` is still empty.
- **No `setInstrument` action.** Locked after creation.
- Migration: if v3 save detected, force `instrument = 'piano'` on the first v4 load.

### `src/utils/instruments.js` (new)
```js
export const INSTRUMENT_RANGES = {
  piano:  [0, 7],
  guitar: [24, 31],
  bass:   [32, 39],
}

export function instrumentOf(track) { /* 'piano' | 'guitar' | 'bass' | 'drums' | 'other' */ }

export function findPlayableTrack(score, playerInstrument) {
  // Returns the Track to render, or null.
  // - guitar → first guitar track
  // - bass   → first bass track
  // - piano  → first piano track, else first guitar track
}

export function scoreIsPlayable(score, playerInstrument) {
  return findPlayableTrack(score, playerInstrument) !== null
}
```

### `src/composables/useAlphaTab.js`
- In `scoreLoaded`: call `findPlayableTrack(score, store.character.instrument)`.
- If null (shouldn't happen if the library filtered correctly, but guard for direct file drops): abort, surface an error message via a new ref `loadError`.
- If match: `api.renderTracks([track])`, then keep the existing `changeTrackSolo` / `changeTrackMute` logic for audio cleanup.

### `src/components/CharacterSetup.vue` (new)
- Full-page (or modal) shown when `character.instrument` is empty (cold start).
- Form:
  - Name input
  - Three instrument cards — name, icon from `public/icons/{piano,guitar,bass}.svg`, large preview avatar from `public/avatars/{piano,guitar,bass}.png`.
  - Selected card's avatar shown larger underneath the picker.
- Submit → `store.createCharacter({ name, instrument })` → screen disappears, main UI mounts.

### `src/components/CharacterStats.vue`
- Show avatar (small, ~32px) + instrument icon next to the name.
- **No picker, no edit affordance.** The instrument is locked.
- Stats unchanged.

### `src/components/TabLibrary.vue`
- Filter the fetched manifest: only show tabs where `scoreIsPlayable` returns true.
- **Challenge**: requires inspecting each tab to know its tracks. Two paths:
  - **Build-time scan (best)**: extend the Vite plugin to parse each tab (alphaTab is browser-only, so we'd need an alternative parser or evaluate via jsdom). Annotate each manifest entry with `availableInstruments: ['piano', 'guitar']`. The library filters off that field client-side.
  - **Pragmatic fallback for v1**: keep all tabs visible in the library. The filtering happens lazily in `useAlphaTab.scoreLoaded`. If the loaded score isn't playable, surface a clear "no <instrument> track in this score" message and refuse to play. Less elegant but works without infra changes.

Pick the build-time scan only if the parsing is straightforward. Otherwise ship the pragmatic fallback and revisit later.

### Assets

- `public/avatars/{piano,guitar,bass}.png` — character portraits used in CharacterSetup and (small) in CharacterStats. ~256x256 source, rendered at multiple sizes via CSS.
- `public/icons/{piano,guitar,bass}.svg` — small monochrome icons (in palm-leaf or ash-brown). Used inline with text.

---

## Cold start flow

1. `App.vue` mounts → `store.load()`.
2. If `character.instrument` is empty → render `CharacterSetup.vue` only.
3. User enters name + picks instrument → `store.createCharacter(...)`.
4. `CharacterSetup` hides, main UI mounts normally.

If the save already has an instrument, the setup is skipped — straight to main UI.

---

## Edge cases

- **Multi-guitar score**: pick the first guitar track. No UI to override (Phase 3 might add it).
- **Score with multiple piano tracks**: same — first piano track wins.
- **Score with only bass + drums** for a guitar player: hidden from library.
- **Single-track piano score** (Mary Had A Little Lamb in some encodings): piano character → matches; guitar character → hidden; bass character → hidden.
- **Single-track guitar score** (River Flows In You): guitar character → matches; piano character → falls back to guitar track; bass character → hidden.
- **Custom file drop with no playable track**: shows the "no <instrument> track" message instead of loading. User can drop another file.

---

## Out of scope here (future plans)

- **Prestige mechanic**: reset character at cap, choose a new instrument, optionally carry a small permanent bonus across runs. Separate plan when relevant.
- **Multi-character slots**: one save per instrument. Significantly more UI; do not bake in v1.
- **Cross-instrument XP transfer**: not relevant until prestige exists.
- **Build-time tab metadata pre-scan**: covered above as a "best path" for the TabLibrary filter. If not done at build, lives as deferred infra work.
- **Drums**: see [2026-05-21-drums-support.md](./2026-05-21-drums-support.md). Different scoring engine, different chart semantics, no shared codepath beyond the instrument selector.

---

## Open questions to resolve before coding

1. **TabLibrary filter strategy**: build-time scan (best UX) vs. lazy filter on load (simpler infra). Recommend: ship lazy filter, revisit build-time scan if the unfiltered library becomes annoying.
2. **Migration policy v3 → v4**: silently default to piano, or force the existing player through CharacterSetup (treating the existing save as orphan stats)? Defaulting to piano is the least disruptive.
3. **Avatars**: where do the assets come from? Need to source/draw 3 character portraits before this phase can ship UX-complete.

---

## Effort estimate

- **Core (instruments.js + character store + useAlphaTab integration + CharacterSetup)**: ~half a day.
- **Lazy-filter TabLibrary path**: included above.
- **Build-time pre-scan**: extra half-day, depending on parser availability.
- **Assets (avatars + icons)**: depends on artwork pipeline.

Phase 1 ships meaningful identity to characters without touching the scoring engine. Drums and prestige come later as independent plans.
