# AlphaTab RPG — Player Guide

You are a beginner musician. You start with weak stats: every score you load plays slowly, you fumble notes, and you run out of breath after a few measures. Practice enough scores and your character improves — until one day you can play anything at full tempo, perfectly, from start to finish.

---

## How a session works

1. **Open the settings gear** (top-left) to adjust the master volume if needed.
2. **Pick a score.** Either click one of the built-in scores on the right, or drop your own file in the *Custom score* dropzone above the library. Supported: Guitar Pro (`.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`) and MusicXML (`.xml`, `.musicxml`).
3. **Press Play.** The score scrolls horizontally and a red cursor follows the beat being played.
4. **Watch the stamina bar.** It drains as you play. If it empties, you collapse and the session ends early.
5. **Reach the end** (or run out of stamina, or hit Stop to give up) and a result panel shows your accuracy and the XP gained.

You **cannot** click on the score to skip ahead. Everything is played in order — no shortcuts.

---

## The three stats

### Speed (integer, starts at 30, caps at 600 — measured in *opm*, onsets per minute)
Your top sustainable note rate. Every score has an inherent **onset rate** — basically, how many note onsets per minute it asks of you. We take the **95th percentile** across the score (so a stray grace note doesn't dominate).

- **Whole note at 80 BPM**: 20 opm — extremely easy
- **Quarter note at 120 BPM**: 120 opm — standard rock/pop
- **Eighths at 120 BPM**: 240 opm — busy
- **Sixteenths at 120 BPM**: 480 opm — shred territory

If your Speed ≥ the score's onset rate, it plays at full tempo. Otherwise, playback slows down by the ratio `speed / onsetRate`. There is **no floor** — if you're hugely underleveled, the music will crawl.

Examples with **Speed = 80**:
- Score full of whole notes at any tempo up to 320 BPM → full tempo ✓
- Pop song at quarter = 120 BPM → plays at 80/120 ≈ 67% tempo
- Metal riff at 16th = 120 BPM (480 opm) → plays at 80/480 ≈ 17% tempo

### Dexterity (0–100%)
Probability of hitting each beat cleanly. Each beat triggers a hidden roll. The threshold drops with:

- **Pitch interval** from the previous note: small steps are nearly free, large leaps are punishing.
- **Beat duration in real time** — and this is where Speed indirectly helps you. If Speed slows the playback to 50%, every beat lasts twice as long, so the roll is much easier. Slow tempo → easy roll. Fast tempo → brutal roll.
- **Chord size**: every extra simultaneous note in a beat is another finger you might miss.

If the roll fails, the audio plays the beat at a **wrong pitch** (offset by ±1 to ±3 semitones) for its entire duration. The displayed score never changes — only the audio reflects your mistakes.

### Endurance (integer, starts at 30, caps at 500)
Endurance is your **note budget for a session**: how many notes you can play before collapsing. Each beat you play consumes a cost between roughly **0.3 and 5+ notes** depending on:

- **Speed of the beat in real time** — same dynamic as Dexterity. If Speed slows the playback, beats last longer and cost less endurance. A sixteenth at notated 200 BPM that actually plays at 50 BPM (because your Speed stat is low) costs the same as a sixteenth at native 50 BPM.
- **Pitch leap** from the previous note — bigger jumps cost more.
- **Chord size** — every extra note in a chord adds 15%.

So 10 quick notes with wide leaps and chords drain your endurance **much faster** than 10 long, single-pitch whole notes. A baseline (single note, quarter at 120 BPM, no jump) costs exactly 1 endurance point.

When total cost exceeds your endurance, the session ends.

---

## How you progress

A session ends in one of three ways, with very different consequences:

| Outcome | Speed | Dexterity | Endurance |
|---|---|---|---|
| **Completed** + accuracy > 70% | +10 opm | +2.0% | +5 notes |
| **Completed** + accuracy ≤ 70% | +10 opm | +0.8% | +5 notes |
| **Stopped manually** | +1 opm | +0.5% | **−2 notes** |
| **Collapsed from exhaustion** | 0 | 0 | **−5 notes** |

**Caps**: Speed 600 opm, Dexterity 100%, Endurance 500 notes.
**Floors**: Speed 30 opm, Dexterity 20%, Endurance 30 notes. You can never go below your starting values — penalties stop biting once you hit the floor.

**Sessions shorter than 10 beats** don't count at all — no XP, no penalty. So if you click Stop right after starting, nothing happens.

**Strategy implications:**
- **Completing a score is by far the most rewarding outcome.** Picking a piece you can actually finish is almost always the right call.
- **Stop is the smart retreat.** If you realise mid-session you'll never finish, hitting Stop costs you 2 endurance but is much better than letting yourself collapse for −5.
- **Letting yourself crash is the worst option.** No XP, and the biggest endurance hit.
- Easier scores are friendlier to your accuracy → bigger dexterity gain on completion.
- Long, slow scores cost little endurance per beat → easier to finish them → most reliable progression source.
- Fast scores with leaps burn through your note budget instantly — they're efficient *only* if you can finish them. Pick wisely.

---

## Save data

Your progress is stored in your browser's `localStorage` under the key `alphatab_rpg_save_v3`. There is no account, no server, and no cloud sync. Closing and reopening the tab restores your character; clearing your browser data wipes it.

Score files are **never** saved — only your stats and a short session history.

The volume setting is stored separately under `alphatab_rpg_volume` and persists across sessions.

To reset your character from scratch, open the browser console and run:

```js
localStorage.removeItem('alphatab_rpg_save_v3')
location.reload()
```

---

## Tips

- A piece that's far too fast at your current Speed stat is the safest way to grind XP: the slow tempo means small endurance cost and easier accuracy.
- If you hear wrong notes, your Dexterity is too low for this passage. Pick simpler music until your stat rises.
- The "Replay" button after a session resets stamina; the score itself stays loaded. Pick another score (or drop a file) to switch pieces.
