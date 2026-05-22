# Plan — Drums support

> Status: draft / future work
> Date: 2026-05-21
> Depends on: [2026-05-21-instrument-selection.md](./2026-05-21-instrument-selection.md) being shipped first (CharacterSetup, instrument-aware track filtering).

## Why this is separate

Drums break the current scoring engine in two fundamental ways:

1. **No pitch intervals.** Every drum "note" is a fixed MIDI value on channel 9 — kick = 36, snare = 38, hi-hat = 42, etc. The "interval to previous note" used by `rollBeatAccuracy` and `beatExhaustion` is meaningless for drums.
2. **The notation looks nothing like a melody.** AlphaTab renders drum tracks on a percussion staff (X-noteheads, no pitch lines). The cursor and highlight logic still works, but the player's mental model is completely different from a guitar/bass/piano staff.

Trying to fold drums into the existing engine would either degrade the melodic instruments' tuning or produce nonsense for the drummer. Hence a separate plan.

---

## Goal

Add **Drums** as a fourth selectable instrument in `CharacterSetup`. A drummer character picks drum tracks, plays them on a percussion-adapted scoring engine, and progresses on the same three stats (Speed, Dexterity, Endurance) with drums-specific cost/difficulty formulas.

---

## Scoring rework for drums

Same three stats, different per-beat formulas.

### Speed (no change)
`scoreOnsetRate` already only counts beat onsets — independent of pitch. Speed stat works as-is.

### Dexterity → `rollBeatAccuracyDrums(dexterity, beat, prevBeat, effectiveBpm)`
Replace the pitch-interval penalty with a **limb-spread** penalty:

- Map every note in the beat to its drum group: `kick`, `snare`, `hat` (closed + open hi-hat), `tom`, `cymbal`, `other`.
- `groupsInBeat` = unique groups hit on this beat.
- **Spread penalty** = `(groupsInBeat - 1) * 0.10`. Two limbs simultaneously is normal; three+ is increasingly hard.
- **Speed penalty** unchanged (depends on real-time gap to previous beat).
- **Chord penalty** drops to `0` — already captured by `groupsInBeat`.

### Endurance → `beatExhaustionDrums(beat, prevBeat, effectiveBpm)`
Same shape as the melodic version, but:
- `intervalFactor` replaced by `limbSpreadFactor = 1 + max(0, groupsInBeat - 1) * 0.20`. Hitting kick + snare + hat simultaneously costs more than just the kick.
- `chordFactor` removed (subsumed by limb spread).

### What's NOT changed
- `playbackMultiplier` derivation from Speed stat — identical.
- Stamina drain accumulation pattern — identical.
- Session outcome rules (completed / stopped / exhausted) — identical.

---

## Files

### `src/utils/drumKit.js` (new)
- Map MIDI percussion note → drum group. Lookup table covering at least:
  - Kick: 35, 36
  - Snare: 38, 40, 37 (rim)
  - Hi-hat: 42 (closed), 44 (pedal), 46 (open)
  - Tom: 41, 43, 45, 47, 48, 50
  - Cymbal: 49 (crash), 51 (ride), 52 (chinese), 53 (ride bell), 55 (splash), 57, 59
  - Else → `other`
- `drumGroupsOf(beat)` → `Set<DrumGroup>`

### `src/utils/rpgEngine.js`
- Add `rollBeatAccuracyDrums()` and `beatExhaustionDrums()`.
- Single dispatch entry point used by `useAlphaTab`:
  ```js
  export function rollBeat(dex, beat, ctx, mode) {
    return mode === 'drums'
      ? rollBeatAccuracyDrums(dex, beat, ctx, ...)
      : rollBeatAccuracy(dex, beat, ctx.prevPitch, ...)
  }
  // same for beatCost
  ```
- The existing melodic functions stay untouched.

### `src/composables/useAlphaTab.js`
- Read `store.character.instrument`. If `'drums'`, dispatch to drums-mode in the per-beat handler.
- Context (`prevBeat`, `lastGroups`) replaces `prevPitch` for drums mode.

### `src/utils/instruments.js`
- Extend `INSTRUMENT_RANGES` / `instrumentOf` to recognize drums via `track.isPercussion`.
- `findPlayableTrack` for `'drums'` → first track where `isPercussion === true`.

### `src/components/CharacterSetup.vue`
- Add Drums as a fourth card.
- Avatar in `public/avatars/drums.png`, icon in `public/icons/drums.svg`.

### `src/components/CharacterStats.vue`
- No structural change (avatar + icon mechanism already covers drums).

---

## Open questions

1. **Limb-spread calibration**: 10%/20% factors are seat-of-pants. Will need playtesting to know if a 3-limb groove drains stamina too fast.
2. **Rolling unit**: one roll per beat (current single-roll architecture) or one roll per limb? Single roll keeps consistency with melodic; per-limb adds depth but doubles complexity. **Recommendation**: single roll.
3. **Visual feedback on miss**: for melodic instruments we transpose the audio. For drums, transposition doesn't make sense (a wrong kick is still a kick). Options:
   - Mute the failed beat entirely (silent miss).
   - Trigger a "stick click" stinger sound.
   - Visual flash on the missed beat with no audio change.
   Pick one before coding. Mute is simplest.
4. **Drum kit detection accuracy**: some custom kits use non-GM mappings. Accept and let the `'other'` bucket absorb edge cases.

---

## Out of scope

- **Two-handed independence simulation** (kick patterns under hand patterns): we already collapse limbs into "groups hit per beat". Going finer would require multi-voice per-track parsing.
- **Genre-specific tuning** (jazz vs metal stamina curves): same engine for all kits in v1.
- **Sticking notation** (R/L): not tracked.

---

## Effort estimate

- `drumKit.js` + dispatch in rpgEngine: ~2h.
- `useAlphaTab` integration: ~1h.
- `findPlayableTrack` extension + CharacterSetup card: ~1h.
- Playtesting and rebalancing: ~half-day minimum.
- Assets (avatar + icon): out of band.

Total: ~one day of dev, possibly more of tuning.
