# AlphaTab RPG

A browser-based incremental music game built on [alphaTab](https://alphatab.net/). The player creates a character (Piano, Guitar, or Bass), loads guitar/piano scores, and plays them. Three character stats (Speed, Dexterity, Endurance) modulate playback in real time and grow as the player completes scores. Categories, playlists, and a per-tab completion record drive the progression loop.

Everything runs client-side — no backend, no account, no network requests after the assets are served. State persists in `localStorage`.

A non-technical guide aimed at end users lives in [USER_README.md](USER_README.md). Design specs and planning notes live in [specs/](specs/).

---

## Prerequisites

- **Node.js ≥ 20.19** (or ≥ 22.12) — required by Vite 7
- **npm ≥ 9**

```bash
node --version
npm --version
```

---

## Installation

```bash
git clone <repo-url> alphatabrpg
cd alphatabrpg
npm install
```

Key dependencies:

- `vue@^3.5` + `pinia@^3` — UI and state management
- `@coderline/alphatab@^1.8` — score parsing, rendering, and playback
- `@coderline/alphatab-vite@^1.8` — Vite plugin (workers, worklets, SoundFont SONiVOX served automatically)
- `vite@^7` + `@vitejs/plugin-vue@^6` — build
- `gh-pages` (devDep) — GitHub Pages deploy

> ⚠️ **Vite compatibility**: stay on Vite 7. Vite 8 (rolldown) breaks `@coderline/alphatab-vite@1.8` with a `Missing field moduleType` error.

---

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Dev server with HMR on http://localhost:5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run deploy` | Build then publish `dist/` to the `gh-pages` branch via [`gh-pages`](https://www.npmjs.com/package/gh-pages) |

---

## Vite configuration

[vite.config.js](vite.config.js) does three things on top of the standard Vue/Vite setup:

1. **`alphaTab()` plugin** — bundles alphaTab workers/worklets and copies the SoundFont + Bravura font assets into the dev server and the build output.
2. **`@` alias** → `src/` for cleaner imports.
3. **Custom `tabsIndexPlugin`** — see [Score manifest pipeline](#score-manifest-pipeline) below.

`base: '/alphatabrpg/'` is configured for GitHub Pages deploys. All asset URLs in the app go through `import.meta.env.BASE_URL` so the same code works under a sub-path or at the root.

---

## Project layout

```
src/
├── main.js                       # Bootstrap Vue + Pinia
├── App.vue                       # 3-column layout (playlist / player / library)
├── stores/
│   └── character.js              # Pinia store: character, stats, completedTabs, save/load
├── composables/
│   ├── useAlphaTab.js            # Encapsulates the AlphaTabApi lifecycle and per-beat logic
│   ├── useSettings.js            # Volume + backing volume settings (persisted)
│   ├── usePlaybackLock.js        # Shared "is the player currently playing?" flag
│   ├── useTabSelection.js        # Channel between TabLibrary/CustomScore and ScorePlayer
│   ├── useTabsManifest.js        # Singleton fetch of /tabs/index.json
│   ├── useTabDifficulty.js       # Background parse of every tab → difficulty stars + playability
│   └── usePlaylist.js            # Queue, current index, consecutive bonus, run state
├── components/
│   ├── CharacterSetup.vue        # Cold-start "create your musician" overlay
│   ├── CharacterStats.vue        # Avatar + 3 stat bars
│   ├── ScorePlayer.vue           # alphaTab host + Play/Stop + Stamina bar
│   ├── SettingsMenu.vue          # Gear button + volume sliders + reset
│   ├── TabLibrary.vue            # Foldable categories of built-in tabs
│   ├── CustomScore.vue           # Locked dropzone (unlocks after 100% completion)
│   ├── FileDropzone.vue          # Reusable file input + drag-and-drop
│   ├── PlaylistColumn.vue        # Left column queue with ✓ / ▶ markers
│   ├── SessionResult.vue         # Post-session panel (gains, penalties, streak bonus)
│   └── DifficultyStars.vue       # Small reusable 1–5 stars component
└── utils/
    ├── rpgEngine.js              # Pure functions: rollBeatAccuracy, beatExhaustion,
    │                             # scoreOnsetRate, analyzeScore, physicalDistance
    ├── instruments.js            # MIDI program ranges, instrument metadata,
    │                             # findPlayableTrack, scoreIsPlayable
    └── categoryUnlocks.js        # Evaluate `unlock` rules from categories.json
```

---

## Score manifest pipeline

Built-in scores live under `public/tabs/<categoryId>/*.gp*` (Guitar Pro 3/4/5/6/X or MusicXML). The root-level `public/tabs/categories.json` declares which categories exist, in what order, how they unlock, and what hint to show when locked.

### `tabsIndexPlugin` (in `vite.config.js`)

The plugin walks the categories declared in `categories.json`, lists files inside each, parses titles/artists from filenames, and emits a unified `tabs/index.json` manifest:

```json
{
  "categories": [{ "id": "...", "label": "...", "order": 1, "unlock": { "type": "always" }, "hint": null }],
  "tabs":       [{ "id": "<category>/<filename>", "category": "...", "artist": "...", "title": "...", "file": "/tabs/.../..." }]
}
```

Tabs whose folder isn't declared in `categories.json`, or tabs sitting at the root of `public/tabs/`, are silently ignored. The filename parser handles common naming patterns:

- `Artist - Title (ver X by Y).ext` — strips parenthesised metadata.
- `Artist-Title-DD-MM-YYYY.ext` — strips trailing dates.
- `N - Title.ext` — kept as-is; numeric-aware sort orders `1, 2, ..., 10` naturally.

In dev mode the manifest is regenerated on every request to `/tabs/index.json`, so adding/removing a file is reflected without restarting the server. At build time the manifest is emitted as a static asset.

### Unlock rules

Defined in `categories.json` and evaluated client-side by [`src/utils/categoryUnlocks.js`](src/utils/categoryUnlocks.js):

| `type` | Fields | Semantics |
|---|---|---|
| `always` | — | Unlocked from session zero. |
| `all_completed` | `category` | Every playable tab in that category has at least one completion. |
| `stat_threshold` | `stat`, `min` | Character stat ≥ min. |
| `any_of` | `rules: [...]` | Any nested rule satisfied. |
| `all_of` | `rules: [...]` | All nested rules satisfied. |

A locked category is rendered in the library only if it carries a `hint`; without one, it's completely hidden until unlocked (good for "secret" categories).

`all_completed` evaluates on the **playable subset** for the current character's instrument — a piano player isn't blocked by a bass-only category they can't see.

---

## Gameplay engine — at a glance

### Character stats

| Stat | Type | Range | Effect |
|---|---|---|---|
| Speed | integer | 30..600 *opm* | Caps the playback tempo. `playbackMultiplier = min(1, speed / scoreOnsetRate)` |
| Dexterity | float | 0.20..1.00 | Per-beat success roll threshold |
| Endurance | integer | 30..500 notes | Per-session "note budget" (stamina) |

### Per-beat loop ([useAlphaTab.js](src/composables/useAlphaTab.js))

On each `playedBeatChanged`:

1. Resolve the *pre-rolled* outcome for the current beat (rolled one beat earlier so the wrong-pitch transposition is set before audio starts → no synth pitch-bend slide).
2. Drain stamina by `beatExhaustion(beat, lastNote, effectiveBpm)`.
3. Pre-roll for the next beat with `rollBeatAccuracy(dexterity, beat, lastNote, effectiveBpm)`.
4. If stamina ≤ 0 → `endSession('exhausted')`.

Both `beatExhaustion` and `rollBeatAccuracy` use [`physicalDistance(prev, current)`](src/utils/rpgEngine.js) to gauge how hard the transition is:

- On TAB-style notes (guitar/bass) → `fretGap + stringGap × 0.5`. Captures position changes vs. string skips.
- On other notes (piano, raw MIDI) → falls back to absolute MIDI interval.

### Session outcomes

| Outcome | When | Speed | Dexterity | Endurance |
|---|---|---|---|---|
| `completed` + accuracy > 70% | `playerFinished` | +10 opm | +2.0% | +5 notes |
| `completed` + accuracy ≤ 70% | `playerFinished` | +10 opm | +0.8% | +5 notes |
| `stopped` | Stop button | +1 opm | +0.5% | −2 notes |
| `exhausted` | stamina depleted | 0 | 0 | −5 notes |

Sessions shorter than 10 beats are discarded entirely (`MIN_BEATS_FOR_OUTCOME`). Stat changes are clamped to `[floor, cap]` and the actual delta (post-clamp) is what gets stored in history and displayed in the session result panel.

### Playlist & streak bonus

The playlist composable owns the queue + run state. Click-to-queue semantics: the first click on an empty queue auto-loads the tab into the player; subsequent clicks append. Hitting **Play** the first time after building a queue marks the run as started.

Stamina **persists** across a playlist run (it's the whole point of playlists). Each consecutive completion within a run multiplies positive stat gains:

| Completions in a row | Multiplier |
|---|---|
| 1 | ×1.00 |
| 2 | ×1.10 |
| 3 | ×1.20 |
| 4+ | ×1.30 (cap) |

`stopped` or `exhausted` ends the run entirely. The post-playlist panel exposes **Replay** which restarts from index 0 with fresh stamina.

---

## Persistence

Local-only, sliced into a few `localStorage` keys:

| Key | Contents |
|---|---|
| `alphatab_rpg_save_v5` | `{ character, history, notesPlayed, completedTabs }` |
| `alphatab_rpg_volume` | Main volume (0..1) |
| `alphatab_rpg_backing_volume` | Backing-track volume (0..1) |

The character store automatically migrates older save versions on load (`v1` → `v2` → ... → `v5`) and removes obsolete keys after a successful upgrade. Migrated saves missing an instrument default to Piano (the most permissive class).

The **Reset character** button in the settings menu wipes `alphatab_rpg_save_v5` and forces the cold-start flow (CharacterSetup overlay). Volume settings are preserved.

Score files are never stored — only the manifest IDs of completed tabs are.

---

## Deployment (GitHub Pages)

`vite.config.js` sets `base: '/alphatabrpg/'`. The `npm run deploy` script (via `gh-pages`) publishes `dist/` to the `gh-pages` branch of the repo. Use `predeploy` to ensure a fresh build precedes every publish.

For root-domain or other-base deploys, change `base` in `vite.config.js`. Asset URLs everywhere in the code already use `import.meta.env.BASE_URL` so they follow the configured base.

---

## Troubleshooting

- **`Missing field moduleType` at build** — Vite 8 is installed. Pin Vite 7:
  ```bash
  npm install --save-dev vite@^7 @vitejs/plugin-vue@^6
  ```
- **`PlayerState is not exported`** — use `alphaTab.synth.PlayerState`, not `alphaTab.PlayerState`. AlphaTab namespaces this enum under `synth`.
- **No audio** — browsers gate audio until a user gesture. Click somewhere on the page before pressing **Play**. Also verify the SoundFont request succeeded (Network tab → `sonivox.sf2` should return 200).
- **"No <Instrument> track in this score."** — the loaded score has no track matching the character's instrument. Per the rules, scores like this are normally hidden from the library; this error only surfaces if a custom file or pre-cache miss slips through.
- **Library shows "Could not load the score list"** — `tabs/index.json` couldn't be fetched. Check that `categories.json` is present and valid JSON. The dev plugin logs a warning on parse errors.
- **Manifest is empty / wrong** — remember tabs at the root of `public/tabs/` or in folders not declared in `categories.json` are silently ignored.
