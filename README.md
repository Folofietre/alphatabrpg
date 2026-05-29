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
├── style.scss                    # Global tokens (CSS custom properties) + base resets
├── App.vue                       # 3-column layout (playlist / player / library)
├── styles/
│   ├── _tokens.scss              # SCSS variables (spacing, radii, transitions) — compile-time only
│   └── _mixins.scss              # Reusable mixins: panel-card, button-base, button-accent,
│                                 # button-danger, section-label, hint-text, progress-track, …
├── stores/
│   └── character.js              # Pinia store: character, stats, tabRecords, save/load
├── composables/
│   ├── useAlphaTab.js            # Encapsulates the AlphaTabApi lifecycle and per-beat logic
│   ├── useSettings.js            # Volume + backing volume settings (persisted)
│   ├── usePlaybackLock.js        # Shared "is the player currently playing?" flag
│   ├── usePlayerActions.js       # Exposes play/stop to non-ScorePlayer components
│   ├── useTabSelection.js        # Channel between TabLibrary/CustomScore and ScorePlayer
│   ├── useTabsManifest.js        # Singleton fetch of /tabs/index.json
│   ├── useTabDifficulty.js       # Background parse of every tab → difficulty stars + playability
│   └── usePlaylist.js            # Queue, current index, consecutive bonus, run state
├── components/
│   ├── CharacterSetup.vue        # Cold-start "create your musician" overlay
│   ├── CharacterStats.vue        # Avatar + 3 stat bars
│   ├── ScorePlayer.vue           # alphaTab host + Stamina bar (transport lives in PlaylistColumn)
│   ├── SettingsMenu.vue          # Gear button + volume sliders + reset
│   ├── TabLibrary.vue            # Foldable categories of built-in tabs
│   ├── CustomScore.vue           # Locked dropzone (unlocks after 100% completion)
│   ├── FileDropzone.vue          # Reusable file input + drag-and-drop
│   ├── PlaylistColumn.vue        # Left column queue + Play/Stop transport
│   ├── SessionResult.vue         # Post-session panel (gains, penalties, streak bonus, high score)
│   ├── DifficultyStars.vue       # Small reusable 1–5 stars component
│   └── ComfortBar.vue            # Signed per-tab familiarity bar with neutral marker
└── utils/
    ├── rpgEngine.js              # Pure functions: beatDC, scoreDC, rollBeatAccuracy,
    │                             # beatExhaustion, scoreOnsetRate, analyzeScore,
    │                             # physicalDistance, effectiveDexFor, compositeScore
    ├── instruments.js            # MIDI program ranges, instrument metadata,
    │                             # findPlayableTrack, scoreIsPlayable
    └── categoryUnlocks.js        # Evaluate `unlock` rules from categories.json
```

---

## Styling

Two layers, kept separate by purpose:

1. **Runtime tokens — CSS custom properties.** All colors, the palette, role aliases (`--bg`, `--panel`, `--accent`, `--warn`…), shadows, fonts. Defined once in [src/style.scss](src/style.scss). Used everywhere through `var(--foo)` so the inspector lets you tweak them live and they're themeable without a rebuild.

2. **Compile-time mixins — SCSS.** Reusable visual patterns ([src/styles/_mixins.scss](src/styles/_mixins.scss)): `panel-card`, `nested-card`, `button-base` / `button-accent` / `button-danger`, `section-label`, `hint-text`, `tabular`, `selectable-card`, `progress-track` / `progress-fill`, `divider`. Tokens that need arithmetic (spacing scale, radius, transitions) live in [src/styles/_tokens.scss](src/styles/_tokens.scss) and are forwarded by `_mixins.scss`.

Components use them like so:

```vue
<style scoped lang="scss">
@use '@/styles/mixins' as *;

.card {
  @include selectable-card;
  padding: 0.65rem 0.8rem;

  &.active { @include selectable-card-active; }
}
.danger-btn { @include button-danger; }
</style>
```

The `@` alias resolves to `src/`, matching the JS import alias. Vite handles SCSS through `sass` (`devDependency`); the `modern-compiler` API is enabled in [vite.config.js](vite.config.js) under `css.preprocessorOptions.scss`.

When adding a new visual pattern that's used by ≥ 2 components, extract a mixin to `_mixins.scss` rather than duplicating CSS. Conversely, one-off styles stay scoped to their `.vue` file.

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

### Character stats (RPG-style: uncapped integers)

| Stat | Type | Start | Floor | Cap | Effect |
|---|---|---:|---:|---:|---|
| Speed | integer | 30 | 30 | none | Defines the **comfort speed** per song: `comfortSpeed = min(1, speed / scoreOnsetRate)`. The user picks the actual playback speed; over-comfort picks penalise each roll. |
| Dexterity | integer | random **50..100** | 50 | none | Compared against per-beat DC via Bradley-Terry. |
| Endurance | integer | 30 | 30 | none | Per-session "note budget" (stamina). |

Penalties never push a stat below its **floor**. The floor is dynamic: it starts at the constant above and ratchets up every time the stat crosses a 50-point **milestone** (`MILESTONE_STEP = 50`). Reaching Dex 150 permanently locks the floor at 150 — losing XP afterwards can shrink the stat back down to 150 but never below. Floors are persisted in `state.floors = { speed, dexterity, endurance }`. There is no upper cap.

### Per-song playback speed

Playback tempo is **player-chosen**, not stat-driven. Each playlist row gets a slider (`SPEED_MIN = 0.20`..`SPEED_MAX = 1.00`, 1% steps). The Speed stat only sets the **comfort threshold**. From the comfort speed and the user's pick, an `overSpeed` divisor is computed:

```
overSpeed = max(1, selectedSpeed / comfortSpeed)
effectiveDex /= overSpeed
```

So picking at or below comfort never penalises (floor is 1); picking 2× comfort halves effective Dexterity for each roll. `api.playbackSpeed` is set to the raw `selectedSpeed`, so `beatExhaustion` (driven by real-time beat duration) and the high-score multiplier scale naturally.

A completed run *above* comfort grants a **+5 Speed bonus** on top of the base gain — Speed only grows when the player stretches.

Slider seeding (in `usePlaylist.append`):

- **First-time queue** (no cached `onsetRate`) → `selectedSpeed = 1.0` (100%). The player doesn't know their comfort yet.
- **Subsequent queues** (`onsetRate` cached) → `selectedSpeed = comfortFor(speed, onsetRate)`.

`onsetRate` is cached eagerly by `cacheTabOnsetRate(tabId, onsetRate)` in `scoreLoaded`, so even a too-short session that never reaches `recordTabSession` still primes future appends with the comfort default. Custom file drops (no playlist entry) default to `1.0`.

### Per-beat loop ([useAlphaTab.js](src/composables/useAlphaTab.js))

On each `playedBeatChanged`:

1. Resolve the *pre-rolled* outcome for the current beat (rolled one beat earlier so the wrong-pitch transposition is set before audio starts → no synth pitch-bend slide).
2. Drain stamina by `beatExhaustion(beat, lastNote, effectiveBpm)`.
3. Pre-roll the next beat with `rollBeatAccuracy(effectiveDex, beat, lastNote, effectiveBpm)` where `effectiveDex = effectiveDexFor(character.dexterity, currentFamiliarity) / overSpeed`.
4. If stamina ≤ 0 → `endSession('exhausted')`.

Per-beat **Difficulty Class** (DC) is computed by [`beatDC()`](src/utils/rpgEngine.js):

```
beatDC = DC_BASE × distanceFactor × chordFactor × speedFactor
```

- `DC_BASE = 60` (a single quarter note, no jump, comfortable tempo).
- `distanceFactor = 1 + max(0, dist - 2) / 8` — uses `physicalDistance` (fret gap + 0.5 × string skip on TAB, MIDI interval otherwise).
- `chordFactor = 1 + (notes.length - 1) × 0.35`.
- `speedFactor = 1 + (1 - ease) × 2` where `ease` is derived from the beat's real-time duration at the effective tempo.

The roll is **Bradley-Terry**: `chance = effectiveDex / (effectiveDex + beatDC)`. Naturally asymptotic, so randomness is always preserved — no explicit miss-rate cap needed.

### Muscle memory (Comfort)

Per-tab `familiarity` ∈ [0, 0.4], persisted in `tabRecords[id]`. `effectiveDexFor(baseDex, familiarity)` applies a **multiplicative** modifier:

```
comfortMod = 1 + (familiarity - 0.20) × 1.0   // range [0.80, 1.20]
effectiveDex = max(10, baseDex × comfortMod)
```

So unfamiliar songs penalise (−20%) and mastered songs reward (+20%) proportionally to the player's current stat. Familiarity grows on every session, faster on completed runs, modulated by `clamp(0.5, 1.5, playerSkill / songDC)`.

### Session outcomes

| Outcome | When | Speed | Dexterity | Endurance |
|---|---|---|---|---|
| `completed` + accuracy > 70% | `playerFinished` | +10 (+5 if above comfort) | +10 | +5 |
| `completed` + accuracy ≤ 70% | `playerFinished` | +10 (+5 if above comfort) | +4 | +5 |
| `stopped` | Stop button | +1 | +1 | −2 |
| `exhausted` | stamina depleted | 0 | 0 | −5 |

Sessions shorter than 10 beats are discarded entirely (`MIN_BEATS_FOR_OUTCOME`). Stat changes are floored — no upper cap, so the displayed delta matches the actual gain unless a penalty would push the stat below its floor.

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
| `alphatab_rpg_save_v7` | `{ character, history, notesPlayed, tabRecords }` |
| `alphatab_rpg_volume` | Main volume (0..1) |
| `alphatab_rpg_backing_volume` | Backing-track volume (0..1) |

**No migration between save versions during development.** On load, any legacy key (`v1` … `v6`) is silently wiped — schema bumps force a fresh character. Once the project stabilises this policy can be replaced with proper migrations.

The **Reset character** button in the settings menu wipes `alphatab_rpg_save_v7` and forces the cold-start flow (CharacterSetup overlay) with a fresh random Dexterity roll. Volume settings are preserved.

Score files are never stored — only the tab IDs in `tabRecords`.

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
