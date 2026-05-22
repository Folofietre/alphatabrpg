# Plan — Muscle memory & per-song records

> Status: draft / future work
> Date: 2026-05-22
> Depends on: Phase 1 (instrument selection) and the categories/playlists plan already shipped.
>
> **Note (2026-05-22)**: the `physicalDistance` helper used by `rollBeatAccuracy`
> and `beatExhaustion` already landed as a small orthogonal fix. Distances are
> no longer pure MIDI intervals — on fretted instruments they combine fret gap
> + (string gap × 0.5). When this plan is implemented, the `estimatedDifficulty`
> stored per-tab will reflect that same metric (the `analyzeScore` function was
> updated at the same time), so the skill-vs-difficulty growth ratio remains
> internally consistent without further tuning.

## Goal

Two intertwined mechanics that turn each individual tab into a progression target:

1. **Muscle memory** — repeated practice on the same song makes the player play it better. Even failures count (a bit), completions count more.
2. **High score** — every song keeps a record of the player's best accuracy and best effective tempo. The player can chase their own previous best.

Together they make replaying a song meaningful even after it's been "completed" — you can grind familiarity, push accuracy, and chase tempo.

---

## Save schema v6

Today `completedTabs` is a `{ [tabId]: { firstCompletedAt, completedCount, bestAccuracy } }` map. We promote it to a more general **`tabRecords`** map:

```js
tabRecords: {
  "firststeps/Twinkle Twinkle Little Star.gp4": {
    attemptsCount: 12,            // any session with >= MIN_BEATS_FOR_OUTCOME
    completionsCount: 4,          // outcome === 'completed'
    firstCompletedAt: ISO | null, // null until first completion
    lastPlayedAt: ISO,            // updated every session
    bestAccuracy: 0..1,           // accuracy on the best-scoring completion
    bestPlaybackSpeed: 0..1,      // playback multiplier on that same run
    bestScore: 0..100,            // composite score = sqrt(acc * speed) * 100
    bestStars: 1..5,              // tier derived from bestScore
    familiarity: 0..0.4,          // muscle memory; neutral point at 0.2
    estimatedDifficulty: 0..1,    // cached from analyzeScore() on first load
  },
  ...
}
```

**Migration**: v5 → v6 walks the existing `completedTabs` map, seeds each entry with `attemptsCount = completionsCount = completedCount`, `bestAccuracy` from the old field, `bestPlaybackSpeed = null` (recomputed on next completion), `bestScore` / `bestStars = null` until a completion provides both axes, `familiarity = 0.2 + 0.2 * min(1, completedCount / 10)` (skewed up so a returning player isn't penalised on songs they already completed), `estimatedDifficulty = null` (populated lazily on next load). The old key is dropped.

---

## Muscle memory mechanic

### Effective dexterity per roll — familiarity is a **signed shift**

Familiarity does not only *boost* the player. At low values it *penalises* them: even a great musician fumbles a song they've never opened. The shift is centred on a neutral point:

```js
const FAMILIARITY_NEUTRAL = 0.20        // where the player plays at their true potential
const EFFECTIVE_DEX_FLOOR = 0.10        // never below 10% — beginners aren't bricked
const EFFECTIVE_DEX_CAP   = 0.95        // never above 95% — music is never robotic

const shift = familiarity - FAMILIARITY_NEUTRAL   // range: [-0.20, +0.20]
effectiveDex = clamp(EFFECTIVE_DEX_FLOOR, EFFECTIVE_DEX_CAP, baseDex + shift)
```

| `baseDex` | `familiarity` | Sense | `effectiveDex` |
|---:|---:|---|---:|
| 0.60 (intermediate) | 0.00 (never played) | **−20% penalty** | 0.40 |
| 0.60 | 0.20 (~10 attempts or ~4 completions) | **neutral** | 0.60 |
| 0.60 | 0.40 (cap) | **+20% bonus** | 0.80 |
| 0.20 (beginner) | 0.00 | floor activated | **0.10** |
| 0.20 | 0.40 | bonus | 0.40 |
| 0.95 (virtuoso) | 0.00 | penalty | 0.75 |
| 0.95 | 0.40 | bonus (cap) | **0.95** |

Reading: a virtuoso opening a brand-new score plays at intermediate level. A beginner is bailed out by the floor — slow going but not all-fail. After ~5 sessions everyone is at their true potential. Mastery (+20%) requires ~10 completions.

The existing per-beat penalties (interval, chord size, speed) still stack on top of `effectiveDex`, so harder passages remain harder.

### Familiarity growth — modulated by skill vs. song difficulty

Base growth applied in `applySessionXP` for any session that counts (≥ 10 beats):

| Event | Base delta |
|---|---:|
| Started a session (any outcome) | +0.02 |
| Completed the session | +0.03 *additional* |

That base delta is then **multiplied by a skill-vs-difficulty factor**. The factor maps the player's general skill to the score's analysed difficulty, capturing both axes the `analyzeScore` formula already weighs (tempo + intervals + density):

```js
const SPEED_CAP = 600
const normalizedSpeed = character.speed / SPEED_CAP          // ~[0.05, 1]
const playerSkill = (character.dexterity + normalizedSpeed) / 2

// difficulty floor protects the ratio from divide-by-near-zero on very easy songs.
const ratio = playerSkill / max(0.15, tabRecord.estimatedDifficulty)
const growthMultiplier = clamp(0.5, 1.5, ratio)

familiarity += baseDelta * growthMultiplier
```

Capped at **0.4** after the increment.

#### Lecture rapide

| Player | Stats | `playerSkill` | Score | `estimatedDifficulty` | ratio | `growthMultiplier` |
|---|---|---:|---|---:|---:|---:|
| Beginner | dex 0.20, spd 30 | 0.125 | Twinkle | 0.10 | 1.25 | ×1.25 |
| Beginner | dex 0.20, spd 30 | 0.125 | Stairway | 0.75 | 0.17 | **×0.5** (clamped) |
| Intermediate | dex 0.50, spd 200 | 0.42 | Twinkle | 0.10 | 4.20 | **×1.5** (clamped) |
| Intermediate | dex 0.50, spd 200 | 0.42 | Stairway | 0.75 | 0.56 | ×0.56 |
| Virtuoso | dex 0.95, spd 600 | 0.98 | Stairway | 0.75 | 1.30 | ×1.30 |
| Virtuoso | dex 0.95, spd 600 | 0.98 | Diff 0.95 | 0.95 | 1.03 | ×1.03 |

So a beginner grinding a hard song retains slowly (realistic). A virtuoso revisiting a children's song nails it in two sessions. A song that matches the player's level grows at the nominal rate.

#### Why `baseDex`, not `effectiveDex`, in `playerSkill`?

If `effectiveDex` (which already includes the familiarity shift) fed back into the growth ratio, the system would self-amplify: high familiarity → higher effectiveDex → higher growth → higher familiarity. We want growth to reflect intrinsic skill, not current familiarity. So `playerSkill` uses **`character.dexterity`** raw.

#### Why include Speed (and not Endurance)?

`analyzeScore` weights tempo (BPM) at 40%, intervals at 40%, density at 20%. The interval/density axes are the dexterity story; the tempo axis is the speed story. Including Speed via `normalizedSpeed = speed / SPEED_CAP` mirrors the difficulty formula symmetrically.

Endurance measures session-long stamina, not per-beat performance. It doesn't help you "learn the notes", just survive a long run. Including it would muddy the signal. If we later want a "tired sessions retain less" mechanic, that's a separate, additive rule.

### Why familiarity boosts Dexterity (and not Speed / Endurance)

Familiarity is a per-song memory of the notes and motions. It maps naturally to accuracy. Adding it to Speed would mean each song has its own tempo cap (confusing), and adding it to Endurance would let players "warm up" on familiar songs (not the intended fantasy). One stat shifted, easy to explain.

---

## High score mechanic

### Composite score

A single percentage value combining accuracy and effective tempo. **Geometric mean** is the formula:

```js
highScore = Math.sqrt(accuracy * playbackMultiplier) * 100
```

| Accuracy | Speed | Score | Star tier |
|---:|---:|---:|---:|
| 100% | 100% | **100%** | ★★★★★ |
| 95% | 90% |  **92%** | ★★★★★ |
| 80% | 80% |  **80%** | ★★★★☆ |
| 70% | 70% |  **70%** | ★★★☆☆ |
| 100% | 50% |  **71%** | ★★★☆☆ |
| 50% | 100% |  **71%** | ★★★☆☆ |
| 50% | 50% |  **50%** | ★★☆☆☆ |
| 30% | 30% |  **30%** | ★☆☆☆☆ |
| 100% | 10% |  **32%** | ★☆☆☆☆ |

**Why geometric mean?**
- A weakness in either axis drags the score → can't fake mastery (eg. playing crawl-slow at 100% accuracy).
- Symmetric: `50/100` and `100/50` give the same `71%`.
- The 100% ceiling means exactly "100% on both" — clean mental model.
- Sub-scores stay round (50/50 = 50%) rather than feeling random.

Alternatives I rejected: arithmetic mean (rewards lopsided runs too much), multiplicative `acc × speed` (too harsh — 50/50 = 25%), weighted variants (arbitrary).

### Star tiers (visual band of the same number)

```js
const STAR_TIERS = [
  { min: 0,  stars: 1 }, // 0–40
  { min: 40, stars: 2 }, // 40–60
  { min: 60, stars: 3 }, // 60–75
  { min: 75, stars: 4 }, // 75–90
  { min: 90, stars: 5 }, // 90+
]
```

5★ is intentionally hard: needs both ≥ ~90% accuracy AND ≥ ~90% tempo. That keeps "5-star a song" as a long-term goal even after first completion.

### Tracked records in `tabRecords`

- **`bestAccuracy`** — accuracy of the highest-score completion (kept for display alongside the score, and informs `recordTabSession` thinking).
- **`bestPlaybackSpeed`** — playback multiplier of the same run.
- **`bestScore`** — the composite percentage, derived from the two above. Stored so we don't recompute on every UI tick.
- **`bestStars`** — derived too, but storing avoids constant tier lookups.

Records are only updated when `outcome === 'completed'` AND the new composite score strictly beats the stored one. Storing all four fields ensures the displayed "94% @ 87% tempo" matches the score that earned it — we don't pick the highest accuracy and the highest tempo from different runs.

### Visibility & UX

We surface familiarity to the player under the label **"Comfort"** in the UI. The internal field stays `familiarity` in code and save (renaming would break the schema for nothing) but every visible string reads "Comfort". Reason: "comfort" matches the *signed* nature of the mechanic ("uncomfortable" vs "in the zone") far better than "familiarity" (which sounds purely positive).

**Per-tab card in TabLibrary** — replace the simple `✓ / ☐` checkbox with a richer status:

```
✓ River Flows In You              Sungha Jung
  ★★★★☆ 84%  ·  ░│▓▓▓ comfort
```

- Star rating + composite % shown when `completionsCount > 0`.
- Comfort rendered as a thin 4-segment bar with a **neutral mark** (`│`) between segments 2 and 3. Left of the mark = penalty zone, right = bonus zone.
- Difficulty stars stay where they are (top-right of the card).
- On hover/title: show "Best: 92% accuracy at 78% tempo · Comfort: 28% (−5% Dexterity on this song)" as a tooltip so the breakdown stays discoverable.

If never attempted: nothing extra (just title/artist/difficulty stars like today). The absence of a comfort bar implicitly signals "0 comfort" without shouting it.

**End-of-session panel** — when the player completes a song:
- If `bestScore` improved → big "New high score! 71% → 84% ★★★★☆" line with the new star tier.
- Otherwise → "Score: 71% ★★★☆☆" silently, no celebration.
- Comfort delta always shown: "Comfort: ░│▓░ → ░│▓▓ (−5% → neutral)" with the transition across the neutral mark called out as a soft milestone ("You know this song now.").

**Comfort tick during gameplay** — *not* shown live (would clutter the score viewer). Only updated post-session in the record.

---

## Where each value flows through the code

```
useAlphaTab.scoreLoaded
  ├─ analyzeScore(score, playableTrack) → estimatedDifficulty
  │     If tabRecords[id].estimatedDifficulty is unset, store the freshly
  │     computed value (it's stable per-tab so cache it).
  ├─ pull tabRecords[currentTabId].familiarity  (0 if absent)
  └─ store both as `currentFamiliarity` and `currentDifficulty` for the run

useAlphaTab.preRoll(beat)
  └─ rollBeatAccuracy(effectiveDexFor(currentFamiliarity), beat, ...)
     // see formula above: clamp(0.10, 0.95, baseDex + familiarity − 0.20)

useAlphaTab.endSession / recordAndAdvance
  └─ store.applySessionXP({
       tabId,
       accuracy,
       outcome,
       beatCount,
       playbackMultiplier,
       bonusMultiplier,
       difficulty: currentDifficulty,   // forwarded for growth modulation
     })

store.applySessionXP
  ├─ existing XP logic (unchanged — playlist bonus, floor/cap clamps, history)
  └─ store.recordTabSession({
       tabId, outcome, accuracy, playbackMultiplier, difficulty,
     }):
       - bump attemptsCount, lastPlayedAt
       - if outcome === 'completed':
           bump completionsCount, set firstCompletedAt if null
           compute score = sqrt(accuracy × playbackMultiplier) × 100
           if score > bestScore (or bestScore unset):
             update bestAccuracy, bestPlaybackSpeed, bestScore, bestStars
       - compute growth:
           base = (outcome === 'completed') ? 0.05 : 0.02
           skill = (dex + speed/SPEED_CAP) / 2
           ratio = skill / max(0.15, difficulty)
           mult = clamp(0.5, 1.5, ratio)
           familiarity = min(0.4, familiarity + base × mult)
       - return {
           familiarityBefore, familiarityAfter,
           scoreBefore, scoreAfter, starsBefore, starsAfter,
           scorePB (bool),
         }

SessionResult.vue
  └─ reads the returned deltas to surface:
       - "New high score!" line if scorePB
       - Comfort before/after bar with neutral-mark crossing called out
```

### Note on `currentDifficulty` source

We already analyze the score in `useTabDifficulty` to render the badge in the library. The same `estimatedDifficulty` value is what `recordTabSession` needs. Two ways to expose it:

1. Cache it inside `useTabDifficulty` and read it from there.
2. Stash it in `tabRecords[id].estimatedDifficulty` on first load (preferred — it persists across sessions, no need to re-parse).

Recommendation: option 2. First time a tab is loaded (or migrated), populate `estimatedDifficulty`. Every subsequent session reads from the record.

---

## Files to touch

- `src/stores/character.js`
  - Bump `SAVE_KEY` to `_v6`, migrate from v5 (see migration block above).
  - Replace `completedTabs` field with `tabRecords`.
  - Replace `markTabCompleted` with `recordTabSession(args)` (broader; includes growth modulation).
  - Extend `applySessionXP` signature to include `playbackMultiplier` and `difficulty`, forward to `recordTabSession`.
- `src/composables/useAlphaTab.js`
  - In `scoreLoaded`: compute or read `estimatedDifficulty`; persist in record if missing.
  - Snapshot `currentFamiliarity` and `currentDifficulty` for the run.
  - In `preRoll`, replace `store.accuracyThreshold` with `effectiveDexFor(currentFamiliarity)` (helper applies the signed shift + clamps).
  - Pass `playbackMultiplier` and `difficulty` to `applySessionXP`.
- `src/utils/rpgEngine.js`
  - Add `effectiveDexFor(baseDex, familiarity)` helper (small, pure, easy to test).
  - Add `compositeScore(accuracy, playbackMultiplier)` and `starTier(score)` helpers.
- `src/utils/categoryUnlocks.js`
  - `all_completed` rule: switch the underlying check from `completedTabs[id]` to `tabRecords[id]?.completionsCount > 0`.
- `src/composables/usePlaylist.js` — no change (the run-level consecutive bonus is separate from familiarity).
- `src/components/TabLibrary.vue`
  - Pull `tabRecords` from the store for each tab; render star tier + composite % + comfort bar.
  - Comfort bar uses a 4-segment renderer with a neutral marker between segments 2 and 3.
- `src/components/SessionResult.vue`
  - Accept a `recordDelta` prop; render "New high score!" + before/after comfort bar with neutral-mark crossing call-out.
- `src/composables/useTabsManifest.js` — no change.
- `src/composables/useTabDifficulty.js` — no change; record now persists the value too but the composable can still hold its in-memory cache for the library badge.

No new files strictly required, though `src/utils/rpgEngine.js` gains three small helpers.

---

## Decisions (locked in unless you say otherwise)

| Decision | Choice | Why |
|---|---|---|
| Stat shifted | Dexterity only | Clean mental model; Speed/Endurance would muddy the per-song idea. |
| Familiarity field range | **[0, 0.4]** | Internal value; UI displays it under the label "Comfort". |
| Familiarity neutral point | **0.20** | Where the player plays at their true potential. Below → penalty, above → bonus. |
| Effective dex floor / cap | **0.10 / 0.95** | Floor protects beginners; cap preserves randomness even on mastered songs. |
| Growth base per attempt | **+0.02** | Failing tabs still get you somewhere. |
| Growth base per completion | **+0.03 additional** | Completion is ~2.5× more rewarding than just attempting. |
| Growth modulator | **`clamp(0.5, 1.5, playerSkill / max(0.15, difficulty))`** | Symmetrical to the difficulty formula; realistic for both ends of the curve. |
| `playerSkill` formula | **`(dex + speed/600) / 2`** | Mirrors `analyzeScore` (40% tempo + 40% interval + 20% density ≈ even split between dex and speed). |
| Playlist bonus amplifies familiarity | **No** | Per the user — familiarity stays self-contained. |
| Score formula | **`sqrt(acc × speed) × 100`** | Geometric mean punishes lopsided runs without being as harsh as multiplicative. |
| Score display | **% + star tier** (1–5) | Number for precision, stars for fantasy. |
| Star tiers | 0/40/60/75/90 | 5★ is hard on purpose — long-term mastery target. |
| Records only on `completed` | Yes | A 5-beat panic-stop session shouldn't reset your record. |
| UI label | **"Comfort"** | Matches the signed (penalty/bonus) nature better than "Familiarity". Internal field stays `familiarity`. |
| `all_completed` rule | unchanged | One completion still suffices to count, no familiarity gate. |
| Custom score unlock | unchanged | Still "every built-in tab completed ≥ 1×". |
| Live comfort widget during play | No | Distraction. Surface deltas in the result panel instead. |
| `estimatedDifficulty` storage | In `tabRecords[id]` | Stable per-tab; populate once at first load, reuse forever. |
| Migration of v5 → v6 | Lossy backfill | `familiarity = 0.2 + 0.2 × min(1, completedCount / 10)` (returning players keep their muscle memory), best-score fields recomputed on next completion. |
| Familiarity decay over time | **No** | Casual proto. Re-introducing it is a separate plan. |
| Endurance should now have a low cap, so that a low familiarity doesnt softlock the player | **Yes** | Should never lower endurance under 30. |

---

## Open notes

- **Reset still wipes `tabRecords`** (it's per-character). If we ever ship Prestige, records will need to either follow the character or be archived.
- **Locked categories don't surface their tabs**, so high-score rendering there is moot for now.

---

## Effort estimate

- Save v6 + record migration + `recordTabSession` action with growth modulation: ~1.5h
- `effectiveDexFor`, `compositeScore`, `starTier` helpers + unit-style sanity checks: ~30min
- Familiarity / difficulty wiring in `useAlphaTab`: ~45min
- TabLibrary card enrichment (stars + score + comfort bar with neutral mark): ~1.5h
- SessionResult deltas + new-high-score celebration + comfort transition: ~1h
- Playtest + tuning of the four magic numbers (neutral, growth base, growth bounds, star tiers): ~45min

Total: **~6h** for everything. The growth modulation + signed-shift adds about ~2h vs. the original "just bonus" plan but it's the part that gives the mechanic its character.

Both halves can ship together — they share `tabRecords`. Splitting them would mean double-touching the schema, not worth it.
