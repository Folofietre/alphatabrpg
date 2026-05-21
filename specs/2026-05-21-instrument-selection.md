# Plan — Instrument-aware character & track auto-selection

> Status: draft / future work
> Date: 2026-05-21

## Goal

At character creation, the player picks an instrument (Guitar, Bass, Drums). 
When a score is loaded, the renderer/player automatically targets the track that matches the character's instrument. 
If no track matches, the score doesnt appear for this player.

This deepens the gameplay loop (a guitarist can't grind drum charts) and naturally limits each character's repertoire.

---

## What AlphaTab gives us

Each `Track` exposes:

- `track.playbackInfo.program` — MIDI GM program 0–127
- `track.playbackInfo.primaryChannel` — MIDI channel (9 = drums in GM)
- `track.isPercussion` — derived flag (true for drum tracks)

MIDI program ranges for our mapping:

| Instrument | Detection |
|---|---|
| Guitar | `program` in 24..31 |
| Bass | `program` in 32..39 |
| Drums | `isPercussion === true` (channel 9) |

Heuristic fallback for badly tagged scores: inspect `track.staves[*]` for TAB presence and note range.

PIANO : search if we can determine if a track is the piano, else its a clone of guitar. They both can play each other parts. Guitar can also play piano tracks.

---

## Phased delivery

### Phase 1 — Guitar + Bass only (no Drums)

Scope: enough to make the instrument choice meaningful without rewriting the scoring engine.

#### Data model

- Save schema bumped to `alphatab_rpg_save_v4`.
- `character.instrument: 'guitar' | 'bass'` (default `'guitar'` on migration).

#### Files

- `src/stores/character.js`
  - Add `instrument` to `defaultCharacter()`.
  - Migration: if loading a v3 save, force `instrument = 'guitar'`.
  - Action `setInstrument(instrument)`.
- `src/utils/instruments.js` (new)
  - `INSTRUMENT_RANGES = { guitar: [24, 31], bass: [32, 39] }`
  - `instrumentOf(track)` → `'guitar' | 'bass' | 'drums' | 'other'`
  - `findTrackForInstrument(score, instrument)` → `Track | null`
- `src/composables/useAlphaTab.js`
  - In `scoreLoaded`: call `findTrackForInstrument(score, store.character.instrument)`.
  - If match: `api.renderTracks([match])` before the existing solo/mute logic, so renderTracks triggers a re-render with that track and only that track is audible.
  - If no match: expose `pendingFallback: ref({ tracks: candidates })` and pause auto-play, let the UI prompt the user.
- `src/components/CharacterStats.vue`
  - Show current instrument next to the name (clickable label).
  - User can only play track of its instrument

#### UI flow

1. Cold start (no save): a `CharacterSetup.vue` screen asks for a name + instrument (each instrument is linked to a pic in public/avatar, used as an avatar, showed under the instrument selector) before showing the main UI. After setup, save is created and the normal app is mounted.
Avatar is shown (small) next to the player name + instrument icon (in public/icons)
2. Score load with matching track: silent auto-select, normal session.
3. From CharacterStats, the user can change instrument at any time (between sessions only — disabled while `usePlaybackLock.isPlaying` is true).

#### Edge cases

- Multi-guitar scores (rhythm + lead): pick the first match.
- Score where the chosen instrument is misregistered (e.g., bass on program 0): the fallback `TrackPicker` covers it.
- Piano and guitar can play each other scores.
- Single-track piano score (the current Mary Had A Little Lamb situation): match piano, playable as well by guitar.
- Single-track guitar score (the current Rivers Flows in You situation): match guitar, playable as well by piano.

---

### Phase 2 — Drums

Drums break the current scoring engine because there is no pitch/interval semantics — every drum "note" is a pad hit on a fixed MIDI note (kick = 36, snare = 38, etc.).

#### Scoring rework for drums

- **Dexterity**: roll based on (a) simultaneous hits per beat (more pads = harder), (b) shortest gap to the previous beat (fast 16th notes = harder). Pitch interval factor → replaced by a "limb-spread" factor counting unique drum groups hit (kick/snare/hat/tom/cymbal).
- **Endurance**: same `beatExhaustion` shape, but interval-factor swapped for limb-spread-factor.
- **Speed**: unchanged, since onset rate computation already only counts beat onsets, not pitch.

#### Files

- `src/utils/rpgEngine.js`
  - Add `rollBeatAccuracyDrums()` and `beatExhaustionDrums()` variants.
  - Dispatch from a single entry point `rollBeat(dexterity, beat, ctx, mode)` where `mode` is derived from `character.instrument`.
- `src/utils/drumKit.js` (new)
  - Map MIDI percussion notes to drum groups (`'kick'`, `'snare'`, `'hat'`, `'tom'`, `'cymbal'`, `'other'`).

#### UI

- Add Drums option to `CharacterSetup` and CharacterStats picker.
- `analyzeScore` (currently unused) can surface "drum density" if we want to add a difficulty badge per built-in tab.

---

### Phase 3 — Optional polish - OUT OF SCOPE

Only worth doing if the game has staying power.

- **One character per instrument**: `state.characters = { guitar, bass, drums }`, save tracks each independently. Switch instrument = switch character. Adds a "main menu" with per-instrument progression. Significantly more UI.
- **Cross-instrument XP transfer**: small percentage of XP gained on one instrument trickles to others (5%). Discourages siloing.
- **Track auto-pick heuristic refinement**: when multiple matches, score them by note count, range, and `playbackInfo.volume` to prefer the "lead" track.
- **Built-in tab metadata**: instead of guessing instrument from the file alone, the Vite plugin could pre-scan tabs at build time and annotate each entry in `tabs/index.json` with `availableInstruments: ['guitar', 'bass']`. Lets the TabLibrary grey out scores incompatible with the current character.

---

## Open questions to resolve before coding

1. **Permissive or strict on no-match?** Phase 1 plan above is permissive (always allow override). Strict variant: no override possible, user must pick a compatible score. Affects how "useless" the player feels with a wrong instrument.
2. **Drums tracking semantics**: is hitting all 3 pads of a beat a single "success" or 3 independent rolls? Current single-roll architecture suggests one success.
3. **Migration policy**: should v3 → v4 silently default to `'guitar'` or force the player through `CharacterSetup` to pick? Either way is reasonable.

---

## Effort estimate

- Phase 1: ~one evening (4–6h) for the essentials, +half-day for `TrackPicker` polish.
- Phase 2: ~one day, dominated by drum scoring rework and play-testing.
- Phase 3: as much as you want to invest.

Phase 1 delivers most of the gameplay impact; everything after is iteration.
