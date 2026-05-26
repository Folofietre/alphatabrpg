# AlphaTab RPG — Player Guide

You're a beginner musician with shaky fingers, low stamina, and tempo that crawls. Every score you load plays slower than written, you fumble notes, and you run out of breath fast. Practice enough scores and your character grows — your **Speed**, **Dexterity**, and **Endurance** stats have no upper limit, so there's always more to grind.

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
| Speed | 30 | 30 | Higher Speed = the score plays closer to its real tempo. |
| Dexterity | 50–100 (random) | 50 | Higher Dexterity = better odds of hitting each beat cleanly. |
| Endurance | 30 | 30 | Higher Endurance = you can play more notes before collapsing. |

Stats grow when you complete songs and shrink slightly when you fail. **No upper bound** — keep grinding, keep growing. The bar in the UI is purely indicative; it slides to the next round milestone as you climb.

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
3. Press **Play**. The score scrolls horizontally; a red cursor follows the beat. Your instrument plays at full volume; the rest of the band plays as backing (volume configurable).
4. Watch the stamina bar — it drains across the **whole playlist**, not per song.
5. When all queued songs finish (or you Stop, or you collapse), a result panel shows what you gained.

---

## How sessions end and what you gain

| Outcome | Speed | Dexterity | Endurance |
|---|---:|---:|---:|
| **Completed** + accuracy > 70% | +10 | +10 | +5 |
| **Completed** + accuracy ≤ 70% | +10 | +4 | +5 |
| **Stopped manually** | +1 | +1 | −2 |
| **Collapsed from exhaustion** | 0 | 0 | −5 |

Penalties never drop you below the starting floor (Speed 30, Dex 50, Endurance 30). Sessions under 10 beats don't count.

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

Once you've completed every built-in score at least once (for your instrument), the *Custom score* dropzone unlocks at the top of the right column. Drop any Guitar Pro (`.gp`, `.gp3-5`, `.gpx`) or MusicXML (`.xml`, `.musicxml`) file in there.

Score files themselves are never saved — only your stats and a small session history.

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

- A piece that's far too fast for your Speed is one of the safest grinds: the forced slowdown gives generous accuracy rolls and tiny endurance cost.
- Re-playing a song you've cleared boosts its **comfort**, which makes future runs easier on that specific song. Comfort caps at +20% on top of your raw Dexterity.
- "Replay" after a session resets stamina and plays the song (or whole playlist) again from the top without you pressing Play.
- Score-switching is locked while the player is running — Stop the session first.
