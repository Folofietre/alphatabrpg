# Plan — Score categories & playlists

> Status: draft / future work
> Date: 2026-05-21
> Depends on: [2026-05-21-instrument-selection.md](./2026-05-21-instrument-selection.md) (Phase 1 shipped).

## Goal

Two intertwined gameplay extensions:

1. **Categories** — organise built-in scores into folders, each with a display name and optional unlock conditions. Locked categories are visible but inaccessible until the player meets the requirements (e.g. "complete all basics", "endurance ≥ 100"). This adds progression structure and a reason to grind specific tabs.

2. **Playlists** — the player queues several scores ahead of time. Sessions chain automatically: when one finishes, the next loads and plays. Stamina carries across the playlist, so finishing a long playlist is a real endurance achievement. Optional consecutive-completion bonus.

Together: categories shape "what's available", playlists shape "what you commit to playing in one sitting".

---

## Part 1 — Categories

### File layout

`public/tabs/` becomes a tree of category folders. The config is the source of truth — **tabs in folders not declared in `categories.json` are ignored**, and **tabs at the root of `public/tabs/` are ignored**. Authors must place files inside a declared category folder for them to be picked up.

```
public/tabs/
├── basics/
│   ├── Misc Children - Twinkle Twinkle Little Star (ver 2 by emad).gp4
│   └── Misc Children - Mary Had A Little Lamb (ver 2 by tombailey1234).gpx
├── intermediate/
│   └── Sungha Jung - River Flows In You.gp5
├── classics/
│   └── Led Zeppelin-Stairway to Heaven-05-15-2026.gp
└── categories.json   ← config (required)
```

### Config: `public/tabs/categories.json`

JSON (native parsing, no extra dep, validates easily). The plugin reads it on every dev request and once at build.

```jsonc
{
  "categories": [
    {
      "id": "basics",
      "label": "Basics",
      "description": "Start here — simple tunes to find your fingers.",
      "order": 1,
      "unlock": { "type": "always" }
    },
    {
      "id": "intermediate",
      "label": "Intermediate",
      "description": "Stretch a bit.",
      "order": 2,
      "unlock": {
        "type": "all_completed",
        "category": "basics"
      },
      "hint": "Complete every track in Basics."
    },
    {
      "id": "classics",
      "label": "Rock Classics",
      "description": "When you can keep up.",
      "order": 3,
      "unlock": {
        "type": "any_of",
        "rules": [
          { "type": "all_completed", "category": "intermediate" },
          { "type": "stat_threshold", "stat": "endurance", "min": 150 }
        ]
      },
      "hint": "Complete every Intermediate track, or reach 150 Endurance."
    },
    {
      "id": "vault",
      "label": "Hidden vault",
      "order": 99,
      "unlock": { "type": "stat_threshold", "stat": "endurance", "min": 400 }
      // no "hint" → entirely hidden until unlocked
    }
  ]
}
```

### Lock visibility — driven by `hint`

- **Rule satisfied** → category is shown unlocked.
- **Rule not satisfied AND `hint` is present** → category is shown as locked with the hint visible.
- **Rule not satisfied AND `hint` is absent** → category is entirely hidden from the UI (a "secret" category, surprises the player when it appears).

This gives full editorial control over what the player can see they're working toward.

Unlock rule grammar:

| `type` | Fields | Meaning |
|---|---|---|
| `always` | — | Unlocked from session zero. |
| `all_completed` | `category` (id) | Every score in that category has been **completed** (outcome === 'completed') at least once. |
| `stat_threshold` | `stat`, `min` | Character stat ≥ min. `stat` ∈ {speed, dexterity, endurance}. |
| `any_of` | `rules: [...]` | Any nested rule satisfied. |
| `all_of` | `rules: [...]` | All nested rules satisfied. |

`dexterity` is a ratio in [0, 1]; spec `min` accordingly (e.g. `0.5` = 50%).

### Manifest extension

The Vite plugin (already does dynamic indexing) is extended to:
- Read `categories.json` at the root of `public/tabs/`. If absent or malformed → emit empty manifest + warn in the console.
- For each declared category, scan its folder. Files outside declared folders (or at root) are silently ignored.
- Emit a richer `tabs/index.json`:

```json
{
  "categories": [
    { "id": "basics", "label": "Basics", "description": "...", "order": 1, "unlock": {...}, "hint": null },
    { "id": "intermediate", "label": "Intermediate", "order": 2, "unlock": {...}, "hint": "..." }
  ],
  "tabs": [
    { "id": "basics/twinkle.gp4", "category": "basics", "artist": "...", "title": "...", "file": "/tabs/basics/..." },
    { "id": "intermediate/river.gp5", "category": "intermediate", ... }
  ]
}
```

The shape mirrors the config but is enriched with the actual file list. `hint` is normalized to `null` when absent so the client doesn't have to distinguish `undefined` from `null`.

### Tracking "completed tabs"

Currently `history` is bounded to the last 20 sessions. That's not enough to remember "every tab the player has completed".

Add to the save (`alphatab_rpg_save_v5`):

```js
completedTabs: {
  "<tab-id>": { firstCompletedAt: ISO, completedCount: N, bestAccuracy: 0..1 }
}
```

`<tab-id>` matches the manifest's `id` field (e.g. `"basics/twinkle.gp4"`). Updated by `applySessionXP` when `outcome === 'completed'`.

This unlocks the `all_completed` rule and gives us material for a future "score record" UI without a separate plan.

### UI changes — right sidebar

`TabLibrary.vue` becomes a list of foldable `<details>`-like sections, one per category, ordered by `category.order`:

```
▼ Basics                                       3/3 completed
  ✓ Twinkle Twinkle Little Star    Traditional
  ✓ Mary Had A Little Lamb         Traditional
  ✓ Twinkle Reprise                Traditional

▼ Intermediate                                 1/2 completed
  ✓ River Flows In You             Sungha Jung
  ☐ Something Else                 Some Artist

▶ Rock Classics                                🔒 LOCKED
   Complete every Intermediate track, or reach 150 Endurance.
```

- Each tab row shows a check (completed) or empty box (not completed).
- Locked-with-hint categories: collapsed, lock icon visible, the configured `hint` rendered as a one-liner under the title.
- Locked-without-hint categories: not rendered at all.
- Locked tabs (inside a locked category): cannot be reached because the category itself is collapsed and read-only. No need for per-tab disabled state.
- Phase-1 instrument filter still applies — tabs incompatible with the current instrument are hidden inside their category. A category that becomes empty for the current instrument is hidden too (no point showing an empty box).

### Files

- `vite.config.js` — extend `tabsIndexPlugin`:
  - Walk subdirectories.
  - Read `categories.json` if present.
  - Emit the richer manifest.
- `src/stores/character.js` — save key `_v5`, add `completedTabs` map, action `markTabCompleted(tabId, accuracy)` called from `applySessionXP`.
- `src/utils/categoryUnlocks.js` (new) — `evaluateUnlock(rule, context)` where context = `{ completedTabsByCategory, character }`. Recursive for `any_of` / `all_of`.
- `src/components/TabLibrary.vue` — render grouped + foldable; show locked state with hint.
- `public/tabs/categories.json` — initial config covering the current scores migrated into a few folders.

### Migration of existing flat tabs

Move the 4 existing tabs under sensible folders (e.g. `basics/` for the two children songs, `intermediate/` for River, `classics/` for Stairway). The Vite plugin's `walk` change handles both flat and nested layouts during the transition.

---

## Part 2 — Playlists

### Concept

A playlist is an ordered list of `tabId`s. The player builds it by clicking tabs in the library. Pressing **Play** on the playlist plays the first item, then the next, then the next, until the playlist is consumed, the player stops, or stamina collapses.

Stamina is **persistent across the playlist** — it does not reset between songs. That's the difficulty curve: long playlists are real endurance tests.

### UX

Add a new column to the left of the main content (3-column layout above the mobile breakpoint):

```
┌──────────┬──────────────────────┬──────────────┐
│ Playlist │   Stats + Player     │ Custom +     │
│  queue   │                      │ Categories   │
└──────────┴──────────────────────┴──────────────┘
```

**Playlist column**:

```
═══ Playlist ═══
► Twinkle (current)
  Mary Had a Little Lamb
  River Flows In You
  Stairway to Heaven

[Clear]   [Save preset…]    ← (presets out of scope for v1)
```

- The current song has a cursor (►).
- Songs already played (in the current playlist run) are grayed out with ✓.
- Songs queued but not yet played are bright.
- Empty slot UI when the playlist is empty: "Click scores on the right to build a playlist."

**Adding to playlist**:

Clicking a tab in `TabLibrary.vue` always appends it to the playlist. **Special case for the first click on an empty playlist**: in addition to appending, the tab is immediately loaded into alphaTab (`currentIndex = 0`, `pendingScore` updated). The player still has to press **Play** to actually start playback — same UX as today's single-tab flow. This keeps the first interaction familiar; the playlist mechanic only "appears" once a second song is added.

So the rule is:

| Playlist before click | Effect of clicking a tab |
|---|---|
| Empty | Append, set as current, load into player. Don't auto-play. |
| Non-empty (idle or playing) | Append at the end. Don't disturb current playback. |

**Playlist controls**:

- Remove individual entry (X button per row).
- Reorder via drag handle (Phase 2 polish; v1 = no reorder).
- Clear all.

### Auto-continue mechanics

When `playerFinished` fires with `outcome === 'completed'`:
1. Increment playlist index.
2. If the next slot exists, set `pendingScore` to that tab. The existing `useTabSelection.pendingScore` watch in `ScorePlayer` loads it.
3. If the playlist is exhausted, show a "Playlist complete!" panel (variant of SessionResult, aggregating gains across the session).

### Stop / Exhausted mid-playlist

Both terminate the full playlist run — no skip-to-next.

- **Stop manually**: ends the run. Post-playlist panel appears.
- **Exhausted**: same. Stamina collapses, run aborts.
- **Replay** button in the post-playlist panel **restarts the playlist from index 0 with full stamina**. The played-state of each song is reset (✓ marks cleared) so the player can re-attempt the whole sequence.

### Stamina persists across the playlist

Stamina is **not** reset between songs in a single run. This is intentional — a long playlist becomes a real endurance test, which gives playlists their identity vs. picking songs one by one. Stamina is only reset at:
- The start of a new playlist run (first Play after building the queue, or Replay).
- A fresh score load that bypasses the playlist (e.g. dropping a custom file while idle).

### Bonus for consecutive completions

Each consecutive completion within a single playlist run grants a multiplicative bonus on XP gains. Shipped in v1 with simple constants — can be re-tuned later without schema changes.

| Consecutive completions in this run | Bonus multiplier |
|---|---|
| 1 | ×1.0 |
| 2 | ×1.10 |
| 3 | ×1.20 |
| 4+ | ×1.30 (cap) |

The multiplier resets to ×1.0 when:
- a song ends with `outcome === 'stopped'` or `'exhausted'` (which also ends the playlist run per the next section),
- the playlist run ends naturally.

Applied to all three positive stat gains (Speed, Dexterity, Endurance). Penalties (stops/exhaust) are not multiplied.

### Files

- `src/composables/usePlaylist.js` (new) — module-scoped singleton, mirrors `useTabSelection`:
  - `queue: ref<TabRef[]>`
  - `currentIndex: ref<number>` (-1 when idle)
  - `played: ref<Set<tabId>>` for the current run
  - `consecutiveCompletes: ref<number>`
  - `append(tab)`, `remove(tabId)`, `clear()`, `start()`, `restart()`, `next()` (called by ScorePlayer on `completed`)
- `src/components/PlaylistColumn.vue` (new) — left column UI.
- `src/components/TabLibrary.vue` — change click behavior: append to playlist instead of selecting via `useTabSelection.selectTab`.
- `src/components/ScorePlayer.vue` — on `playerFinished`/completed: notify `usePlaylist.next()`, which sets `pendingScore` to next tab (using the existing channel).
- `src/components/SessionResult.vue` — when the playlist still has tabs, automatically transition without showing the result panel (or show a brief "Next: <song>" toast for 1s). When the playlist ends or run aborts, show the panel with aggregated stats.
- `src/App.vue` — new 3-column grid layout, mobile fallback to stacked.

### Layout adjustment

Current: `grid-template-columns: minmax(0, 1fr) 280px`.
New: `grid-template-columns: 260px minmax(0, 1fr) 280px` on wide viewports; stacked on narrow.

### Edge cases

- **Adding while playing**: allowed — the queue updates live; the user can extend a running playlist by clicking more tabs. Position is appended after the current index.
- **Removing the currently-playing song**: disallowed (its X button is hidden while it's playing).
- **Locked tabs in the queue**: shouldn't be addable in the first place because `TabLibrary` only lets you click unlocked ones.
- **Mixed-instrument shenanigans**: with Phase 1 in place, only tabs playable by the current instrument appear in the library, so this is moot.

---

## Out of scope here (note for future)

- **Saved playlist presets** ("My warmup", "Recital", etc.) persisted to localStorage. Easy add later.
- **Playlist sharing** (URL-encoded queue, copy/paste). Useful with multiplayer/social vibes.
- **Per-category rewards** ("complete this category for a unique cosmetic"). Layer on top once the cosmetic system exists.
- **Reordering by drag**: ship without it; add a polish PR after v1.

---

## Decisions (locked in)

1. **"Completed" for `all_completed`** = `outcome === 'completed'`. No accuracy threshold.
2. **Locked categories**: visible-with-hint when `hint` is configured; entirely hidden when `hint` is absent.
3. **Click on a tab**: always appends to the playlist. If the playlist was empty, the tab also becomes the current one and loads into the player (user still presses Play). If non-empty, just appends silently.
4. **Consecutive bonus** shipped in v1 with the table above. Tuning later.
5. **Stop mid-playlist** = abort the whole run.
6. **Tabs outside declared categories** are ignored.
7. **Config format**: JSON.
8. **Stamina across the playlist**: persistent — long playlists = endurance test.
9. **Replay** after a playlist run: restart from index 0 with full stamina.

---

## Effort estimate

- **Categories core** (manifest extension + `categoryUnlocks.js` + foldable TabLibrary): ~half a day.
- **Save schema v5 + `completedTabs` tracking + migration**: ~1h.
- **Playlists core** (`usePlaylist.js` + PlaylistColumn + auto-chaining): ~half a day.
- **Layout 3-column shift**: ~1h.
- **Consecutive bonus**: ~30min once the rest works.
- **Migration of existing flat tabs into folders + `categories.json` seed config**: ~30min.

Total: roughly **one and a half days** for everything if no surprises.

Either part can ship independently — Categories alone is valuable, Playlists alone is valuable. They reinforce each other but aren't coupled.
