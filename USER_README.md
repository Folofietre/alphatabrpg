# AlphaTab RPG — Player Guide

You're a beginner musician with shaky fingers, low stamina, and tempo that crawls. Every score you load plays slower than written, you fumble notes, and you run out of breath fast. Practice enough scores and your character grows — until one day you nail anything at full tempo from start to finish.

This is a single-player browser game. Everything lives in your browser, nothing is sent anywhere, and you can close the tab whenever you want.

---

## First time setup

When you launch the game for the first time, pick a **name** and an **instrument**. The choice is **permanent** for this character — switching instruments will come later as a Prestige reward.

Three instruments are available right now:

- 🎹 **Piano** — the classic experience. Piano players can play piano scores *and* fall back to guitar scores when no piano track is in the file. Broadest repertoire.
- 🎸 **Guitar** — plays guitar scores only. More flavor, fewer choices.
- 🪕 **Bass** — plays bass scores only. Same deal.

(A 🥁 **Drummer** card is visible but locked — coming in a future update.)

After setup, your character is saved automatically in your browser.

---

## How a session works

1. **Pick a score** from the *Score library* on the right. Categories unfold to show the tabs inside. Click a tab to add it to your **Playlist** (left column). The first click also loads it into the player.
2. *(Optional)* **Queue more scores** by clicking other tabs — they line up after the current one.
3. **Press Play.** The score scrolls horizontally and a red cursor follows the current beat. Audio plays you at full volume; the rest of the band is heard in the background.
4. **Watch the stamina bar.** It drains as you play and is shared across the whole playlist — finishing a long playlist is a real endurance test.
5. **Reach the end** of every queued song (or run out of stamina, or hit Stop) and a result panel shows how it went.

You can't click on the score to skip ahead. The cursor follows the playback in real time — you play what your character can play.

---

## The Score library

Tabs are grouped into **categories** (First Steps, Solo Practice, Fingerpicking, Classic Songs…). Each category has its own unlock rule:

- 🔓 **Unlocked** — fold open, click to queue.
- 🔒 **Locked** — the unlock hint tells you what to grind ("Complete every First Steps track", "Reach 100 Endurance"…). Categories with no hint are hidden entirely until unlocked.

Each tab shows a **difficulty rating** (1–5 stars) computed from its tempo, note jumps, and note density. Tabs that don't have a track for your instrument are simply not shown to you.

A green check (`✓`) next to a tab means you've completed it at least once.

---

## The Playlist

The left column is your queue. Clicking a tab in the library adds it. Drag's not in yet, but you can remove individual entries with the `×` button or clear the whole queue with **Clear**.

Once you press Play, the songs chain automatically: when one finishes, the next loads and plays. Your stamina **does not reset** between songs — that's what makes long playlists challenging.

If you hit Stop or collapse from exhaustion **mid-playlist**, the whole run ends. The post-playlist panel offers a **Replay** button that restarts from the first song with full stamina.

### Consecutive streak bonus

Completing songs back-to-back in a playlist applies a bonus multiplier to your stat gains:

| Completions in a row | Bonus |
|---|---|
| 1 | ×1.0 |
| 2 | ×1.10 |
| 3 | ×1.20 |
| 4+ | ×1.30 (cap) |

Failing or stopping a song resets the streak to ×1.0.

---

## Your three stats

Stats grow when you complete songs and shrink slightly when you fail. Speed and Endurance are integers; Dexterity is a percentage.

### Speed — *opm* (onsets per minute)

Your top sustainable note rate. Every score has an inherent onset rate (how many notes per minute it asks for, measured at the 95th percentile so the odd grace note doesn't dominate). If your Speed ≥ the score's onset rate, it plays at full tempo. Otherwise, playback **slows down**, in proportion. There's no floor — at low Speed, hard songs will crawl.

Quick reference:

| Beat type at 120 BPM | Onset rate |
|---|---|
| Whole notes | 30 opm |
| Quarter notes | 120 opm |
| Eighth notes | 240 opm |
| Sixteenth notes | 480 opm |

### Dexterity — % chance to hit each beat cleanly

A hidden roll fires on every beat. The roll gets harder when:

- The **hand has to move** a lot from the previous note (long fret jumps on guitar/bass, big intervals on piano).
- The beat lasts a **very short time** in real-time (Speed slowdown makes things easier here — slow tempo = generous rolls).
- The beat contains **multiple simultaneous notes** (every extra finger you might miss).

When the roll fails, the audio plays the wrong pitch (off by 1–3 semitones) for that beat. The displayed score doesn't change — only what you *hear* reflects your mistakes.

### Endurance — total notes you can play in one session

Endurance is a budget. Every beat costs some "notes" out of that budget; when the budget runs out, your character collapses. A baseline note (a quarter at 120 BPM with no jump) costs 1. Faster notes, bigger jumps, and bigger chords cost more.

In a playlist, the budget is shared across the whole run — Endurance is the cost of stringing pieces together.

---

## How sessions end (and what you gain)

A session can finish in three ways:

| Outcome | Speed | Dexterity | Endurance |
|---|---|---|---|
| **Completed** + accuracy > 70% | +10 opm | +2.0% | +5 notes |
| **Completed** + accuracy ≤ 70% | +10 opm | +0.8% | +5 notes |
| **Stopped manually** | +1 opm | +0.5% | **−2 notes** |
| **Collapsed from exhaustion** | 0 | 0 | **−5 notes** |

**Caps**: Speed 600, Dexterity 100%, Endurance 500. **Floors**: 30, 20%, 30 — penalties stop biting once you hit the floor, so you can't soft-lock yourself.

**Sessions under 10 beats don't count.** Click Stop right after starting and nothing happens (no gain, no penalty).

**Strategy:**

- **Finishing is by far the most rewarding outcome.** Pick songs you can complete.
- **Stop = smart retreat.** Realising mid-song you'll never make it? Hit Stop. −2 endurance hurts less than crashing for −5.
- **Crashing is the worst path.** No XP, biggest endurance hit.
- Long, slow scores are stamina-friendly — easy to finish, reliable progression.
- Fast, leap-heavy scores burn endurance fast — efficient *only* if you can survive them.

---

## Settings

Open the gear in the top-left:

- **Volume** — main volume of everything alphaTab plays.
- **Backing volume** — how loud the other tracks in the score (drums, bass, etc.) are relative to your instrument. Lower it if you want to focus on what *you* play.
- **Reset character** (Danger zone) — wipes your save and starts from scratch. Useful if you backed yourself into a corner.

---

## Custom scores

Once you've completed **every** built-in score at least once (for your instrument), the *Custom score* dropzone unlocks at the top of the right column. You can then drop any Guitar Pro (`.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`) or MusicXML (`.xml`, `.musicxml`) file in there and play it.

Until then the dropzone shows your progress: "(*N*/*M*) — Complete every built-in score to unlock custom uploads."

Score files themselves are never saved between sessions — only your stats and a small session history.

---

## Save data

Everything lives in your browser's `localStorage`. Closing and reopening the tab restores your character; clearing your browser data wipes it. The "Reset character" button in the settings menu is the clean way to start over.

There's no account, no server, no cloud sync. Take care of your save.

---

## Tips

- A piece that's far too fast for your Speed is actually one of the safest grinds: the slow forced tempo means tiny endurance cost and generous accuracy rolls.
- Hearing wrong notes constantly? Your Dexterity is too low for that passage. Pick easier music until the stat rises.
- "Replay" after a session resets stamina and plays the song (or the whole playlist) again from the top, without you having to press Play.
- Stop / Pause is disabled while the player is idle. Score-switching is locked while the player is running — Stop the session first.
- Drop a single one-off custom file (once unlocked) and it bypasses the playlist — it plays directly, alone.
