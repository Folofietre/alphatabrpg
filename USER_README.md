# AlphaTab RPG — Player Guide

You're a beginner musician with shaky fingers, low stamina, and a fragile sense of tempo. You decide how fast every song plays — pick a comfortable tempo and you'll roll cleanly; crank it up and the score gets juicier but the misses pile up. Practice enough scores and your character grows — your **Speed**, **Dexterity**, and **Endurance** stats have no upper limit, so there's always more to grind.

This is a single-player browser game. Everything lives in your browser, nothing is sent anywhere.

---

## First time setup

When you launch the game for the first time, pick a **name** and an **instrument**. The choice is **permanent** for this character.

- 🎹 **Piano** — the classic experience. Piano players can play piano scores *and* fall back to guitar scores when no piano track is in the file.
- 🎸 **Guitar** — plays guitar scores only.
- 🪕 **Bass** — plays bass scores only.
- 🥁 **Drummer** — locked, coming in a future update.

Your initial **Dexterity** is rolled randomly between **50 and 100** at creation — like rolling stats in a tabletop RPG, you might get a slight head start or have to work a bit more.

---

## The three stats — plain integers, no cap

| Stat | Start | Floor | What it does |
|---|---:|---:|---|
| Speed | 30 | 30 | Sets your **comfort speed** for each song. The higher this stat, the faster you can pick a song without rolls getting punished. |
| Dexterity | 50–100 (random) | 50 | Higher Dexterity = better odds of hitting each beat cleanly. |
| Endurance | 30 | 30 | Higher Endurance = you can play more notes before collapsing. |

Stats grow when you complete songs and shrink slightly when you fail. **No upper bound** — keep grinding, keep growing.

Every **50 points** is a **milestone**. Once you reach a milestone, it becomes your new floor for that stat — you can never drop back below it. So if your Dexterity hits 150, even a string of bad runs can't push you under 150 again. The bar fills your current 50-point segment; the tooltip shows your locked-in floor and the next milestone.

---

## How a beat is rolled (Dexterity in action)

Every beat in the score has a **Difficulty Class (DC)** — a single number combining note jump distance, chord size, and how short the beat is. A trivial single quarter note has DC around 60; a fast chord with a big leap can pass DC 1000+.

When the cursor reaches the beat, your effective dexterity is compared to the DC:

```
chance = effectiveDex / (effectiveDex + DC)
```

| Your effectiveDex | Beat DC | Chance of hitting cleanly |
|---:|---:|---:|
| 60 | 60 | 50% (parity) |
| 200 | 60 | 77% |
| 60 | 200 | 23% |
| 600 | 60 | 91% |
| 60 | 600 | 9% |

This formula has nice properties:

- **No 100% ceiling.** Music is never robotic — there's always a sliver of randomness.
- **Diminishing returns.** Going from Dex 100 to 200 on an easy beat (+27% chance) is a much bigger boost than going from Dex 900 to 1000 (+1% chance). The early grind is the most rewarding per point.
- **The challenge always exists.** A future ultra-hard tab can simply have DC 2000 and remain a real test even for veteran characters.

When the roll fails, the audio plays the wrong pitch (off by 1–3 semitones) for that beat. The displayed score doesn't change — only what you *hear* reflects your mistakes.

---

## Comfort (muscle memory, per song)

The more you practice a song, the more "comfortable" you become with it. Comfort is a **multiplicative modifier** on your Dexterity for *that song only*:

| Comfort | Effective Dex |
|---|---|
| 0 (never played) | baseDex × 0.80 (−20%) |
| 0.20 (a few plays) | baseDex × 1.00 (neutral) |
| 0.40 (mastered) | baseDex × 1.20 (+20%) |

So even a virtuoso fumbles a song they've never opened — that's the muscle memory model. Every play grows comfort a little; completed sessions grow it more. Growth is also modulated by how the song's DC compares to your skill (easier songs are quicker to internalize).

---

## How a session works

1. Pick a score from the right column.
2. Click it to add it to your **Playlist** (left column). First click also loads it. Click more to queue more.
3. **Set the speed** for each playlist row using the slider next to the title. A small notch shows your *comfort speed* for the song (your Speed stat divided by the song's onset rate).
4. Press **Play**. The score scrolls horizontally; a red cursor follows the beat. Your instrument plays at full volume; the rest of the band plays as backing (volume configurable). All sliders lock until the run ends.
5. Watch the stamina bar — it drains across the **whole playlist**, not per song.
6. When all queued songs finish (or you Stop, or you collapse), a result panel shows what you gained.

---

## Choosing a song's speed

A slider on each playlist row controls how fast the song plays, from **20% to 100%** of the written tempo (1% increments). The notch on the slider is your **comfort speed** — derived from your Speed stat vs. how note-dense the song is.

- **Below comfort** — the song plays slow. Easier on stamina, but the high score scales with speed so you score less.
- **At comfort** — natural rolls. The slider notch is roughly where you should land for everyday practice.
- **Above comfort** — every beat gets harder by the *over-speed factor* (`selected / comfort`). At 2× comfort, every beat's effective Dexterity is halved. Your score scales up though: 100% pays the biggest reward.

**The first time you queue a song**, the slider defaults to **100%** — you have no idea what your comfort speed is yet, so the game opens at full tempo and lets you discover. **After the first play**, the song's comfort is known and future queues default to your **comfort speed** for that song. You can always drag the slider to whatever you want.

**Completing a song above your comfort grants a +5 Speed bonus** on top of the normal gains — Speed only grows when you push past your current limit.

For dropped custom files, the default speed is **100%** (challenge mode, you opted in).

---

## How sessions end and what you gain

| Outcome | Speed | Dexterity | Endurance |
|---|---:|---:|---:|
| **Completed** + accuracy > 70% | +10 | +10 | +5 |
| **Completed** + accuracy ≤ 70% | +10 | +4 | +5 |
| **Stopped manually** | +1 | +1 | −2 |
| **Collapsed from exhaustion** | 0 | 0 | −5 |

Penalties never drop you below your current floor — your starting floor (Speed 30, Dex 50, Endurance 30) ratchets up every 50 points you reach. Sessions under 10 beats don't count.

**Strategy:**

- **Finishing is by far the most rewarding outcome.** Pick songs you can complete.
- **Stop = smart retreat.** Hitting Stop costs less than crashing.
- **Crashing is the worst path.** Maximum penalty, no progress.
- Long, slow scores are stamina-friendly — easy to finish.
- Fast scores burn endurance fast — efficient *only* if you can survive them.

### Streak bonus

Completing songs back-to-back in a single playlist run multiplies positive gains:

| Completions in a row | Multiplier |
|---:|---:|
| 1 | ×1.00 |
| 2 | ×1.10 |
| 3 | ×1.20 |
| 4+ | ×1.30 (cap) |

Failing a song resets the streak.

---

## The Score library

Tabs are grouped into **categories** (First Steps, Solo Practice, Fingerpicking, Classic Songs, …). Each one has its own unlock rule:

- 🔓 **Unlocked** — fold open, click to queue.
- 🔒 **Locked** — the unlock hint tells you what to grind ("Complete every First Steps track", "Reach 800 Dexterity"…). Categories with no hint are hidden entirely until unlocked.

Each tab shows a **difficulty rating** (1–5 stars) based on its DC. Once you've completed a tab at least once, a **🏆 high score** appears next to it. The high score is a single integer that combines your accuracy, your effective tempo, and the song's difficulty:

- An easy tune mastered → roughly **1 000**.
- A medium song nailed → several thousand.
- A virtuoso piece pulled off → tens of thousands.

There's no cap — chasing a higher number on a tab you've already cleared is a long-term goal. Hard songs reward you with bigger numbers even on imperfect runs.

---

## Custom scores

Coming back as an **end-game reward**: once every built-in score has been completed at least once (for your instrument), the *Custom score* dropzone will unlock and let you drop Guitar Pro / MusicXML files of your own. Disabled for now while we finish the core loop.

---

## Settings

Open the gear (top-left):

- **Volume** — main volume of everything alphaTab plays.
- **Backing volume** — how loud the other tracks in the score are relative to your instrument.
- **Reset character** (Danger zone) — wipes your save and starts from scratch with a fresh Dexterity roll.

---

## Save data

Everything lives in your browser's `localStorage`. Closing and reopening the tab restores your character; clearing your browser data wipes it.

The game is still in active development. **Schema changes may force a fresh character** — when this happens, your old save is wiped on next launch with no migration.

---

## Tips

- **You decide the trade-off, per song.** Slow speed = easy roll but small score. 100% = max score but punishing rolls if it's above your comfort.
- The **+5 Speed bonus** on completing above comfort is the only way Speed grows beyond the base +10 — staying in comfort all the time is fine but caps your Speed progression.
- Re-playing a song you've cleared boosts its **comfort** (familiarity), which makes future runs easier on that specific song. Comfort caps at +20% on top of your raw Dexterity.
- "Replay" after a session resets stamina and plays the song (or whole playlist) again from the top without you pressing Play.
- Score-switching is locked while the player is running — Stop the session first.
