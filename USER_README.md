# AlphaTab RPG — Player Guide

You are a beginner musician. You start with weak stats: every score you load plays slowly, you fumble notes, and you run out of breath after a few measures. Practice enough scores and your character improves — until one day you can play anything at full tempo, perfectly, from start to finish.

---

## How a session works

1. **Open the settings gear** (top-left) to adjust the master volume if needed.
2. **Drop a score** into the dropzone. Supported: Guitar Pro (`.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`) and MusicXML (`.xml`, `.musicxml`).
3. **Press Play.** The score scrolls horizontally and a red cursor follows the beat being played.
4. **Watch the stamina bar.** It drains as you play. If it empties, you collapse and the session ends early.
5. **Reach the end** (or run out of stamina) and a result panel shows your accuracy and the XP gained.

You **cannot** click on the score to skip ahead. Everything is played in order — no shortcuts.

---

## The three stats

All three stats are values between 0 and 1 (displayed as a percentage). They start low and only grow through play.

### Speed
Multiplies the score's tempo. At **35%**, the score plays at 35% of its real tempo. At **100%**, real tempo. There is no way to override the speed — you play what your character can play.

### Dexterity
Probability of hitting each note cleanly. Each note triggers a hidden dice roll:

- A wider pitch interval from the previous note makes the roll harder.
- Fast subdivisions (note duration value > 8 — sixteenths and shorter) add extra difficulty.
- If the roll fails, the audio transposes by ±1 to ±3 semitones for the **entire duration of that beat** — the wrong note (or chord) holds until the next beat arrives.

**The displayed score never changes.** Only the audio reflects your mistakes.

### Endurance
Two things:

- It sets the **maximum stamina** for a session.
- A higher endurance value also makes stamina drain **slower per beat**.

Stamina drain is also tempo-sensitive: a 240 BPM piece drains twice as fast as a 120 BPM piece, all else equal.

---

## How you progress

At the end of every session, regardless of how it ended, your stats go up:

| Stat | If you finished the score | If you ran out of stamina |
|---|---|---|
| Speed | +1.5% | +0.5% |
| Endurance | +1.2% | +0.4% |

| Stat | If accuracy > 70% | Otherwise |
|---|---|---|
| Dexterity | +2.0% | +0.8% |

Stats are capped at 100%. Once a stat hits 100%, more sessions won't push it higher.

**Strategy implications:**
- Quitting in the middle still rewards you, just less. There's no punishment for an aborted session beyond reduced gains.
- Easier scores are friendlier to your accuracy → faster dexterity growth.
- Long, slow scores are stamina-friendly → easier to finish them → maximize speed/endurance gains.
- High-tempo scores burn stamina fast and challenge dexterity — they're efficient if you can survive them.

---

## Save data

Your progress is stored in your browser's `localStorage` under the key `alphatab_rpg_save`. There is no account, no server, and no cloud sync. Closing and reopening the tab restores your character; clearing your browser data wipes it.

Score files are **never** saved — only your stats and a short session history.

The volume setting is stored separately under `alphatab_rpg_volume` and persists across sessions.

To reset your character from scratch, open the browser console and run:

```js
localStorage.removeItem('alphatab_rpg_save')
location.reload()
```

---

## Tips

- A piece that's far too fast at your current Speed stat is the safest way to grind XP: the slow tempo means small stamina drain and easier accuracy.
- If you hear wrong notes, your Dexterity is too low for this passage. Pick simpler music until your stat rises.
- The "Replay" button after a session resets stamina; the score itself stays loaded. Drop a new file to switch pieces.
