// ---------------------------------------------------------------------------
// Muscle memory & tuning constants
// ---------------------------------------------------------------------------

export const FAMILIARITY_CAP = 0.40
export const FAMILIARITY_NEUTRAL = 0.20

// Comfort is a multiplicative modifier on baseDex.
// At familiarity 0    → effectiveDex = baseDex × 0.80 (penalty)
// At familiarity 0.20 → effectiveDex = baseDex × 1.00 (neutral)
// At familiarity 0.40 → effectiveDex = baseDex × 1.20 (bonus)
const COMFORT_RANGE = 0.20

// Lower bound on effective dex to avoid divide-by-zero / silly maths even if
// the player rolls bottom-of-the-barrel stats on an unfamiliar score.
const EFFECTIVE_DEX_FLOOR = 10

export function effectiveDexFor(baseDex, familiarity = 0) {
  const f = familiarity ?? 0
  const comfortMod = 1 + (f - FAMILIARITY_NEUTRAL) * (COMFORT_RANGE / FAMILIARITY_NEUTRAL)
  return Math.max(EFFECTIVE_DEX_FLOOR, (baseDex ?? 0) * comfortMod)
}

// ---------------------------------------------------------------------------
// Per-completion composite score (display)
// ---------------------------------------------------------------------------

// Multiplier that scales the geometric-mean performance × song DC into a
// plain integer score. Chosen so a perfect run on an easy song (DC ~60)
// reads around 1000, and a perfect run on a very hard song (DC ~5000)
// reads around 90 000.
const SCORE_SCALE = 18

// Geometric mean of accuracy and playback speed, scaled by the song's DC.
// Unbounded integer — a "great run on a hard song" can beat a "perfect run on
// an easy song", which is the whole point of leaderboards on this game.
export function compositeScore(accuracy, playbackMultiplier, dc = DC_BASE) {
  const a = Math.max(0, Math.min(1, accuracy ?? 0))
  const s = Math.max(0, Math.min(1, playbackMultiplier ?? 0))
  const d = Math.max(DC_BASE, dc ?? DC_BASE)
  return Math.round(Math.sqrt(a * s) * d * SCORE_SCALE)
}

// ---------------------------------------------------------------------------
// Physical distance between two notes
// ---------------------------------------------------------------------------

const STRING_SKIP_WEIGHT = 0.5

function hasFretboardInfo(note) {
  return (
    note &&
    typeof note.fret === 'number' &&
    typeof note.string === 'number' &&
    note.string > 0
  )
}

function midiOf(note, fallback = 60) {
  return note?.realValue ?? note?.value ?? fallback
}

export function physicalDistance(prevNote, note) {
  if (hasFretboardInfo(prevNote) && hasFretboardInfo(note)) {
    const fretGap = Math.abs(note.fret - prevNote.fret)
    const stringGap = Math.abs(note.string - prevNote.string)
    return fretGap + stringGap * STRING_SKIP_WEIGHT
  }
  return Math.abs(midiOf(note) - midiOf(prevNote))
}

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

function realDurationSeconds(durationValue, effectiveBpm) {
  const v = durationValue ?? 4
  const quarterSeconds = 60 / Math.max(1, effectiveBpm)
  return v < 0
    ? quarterSeconds * 4 * Math.abs(v)
    : quarterSeconds * (4 / Math.max(1, v))
}

// ---------------------------------------------------------------------------
// Onset rate (drives Speed-vs-tempo playback multiplier)
// ---------------------------------------------------------------------------

function beatOnsetRate(beat, bpm) {
  const v = beat.duration?.value ?? 4
  const factor = v < 0 ? 1 / (4 * Math.abs(v)) : v / 4
  return bpm * factor
}

export function scoreOnsetRate(score, track = null) {
  if (!score) return 120
  const t = track ?? score.tracks?.[0]
  if (!t) return 120
  const bpm = score.tempo ?? 120

  const rates = []
  for (const staff of t.staves ?? []) {
    for (const bar of staff.bars ?? []) {
      for (const voice of bar.voices ?? []) {
        for (const beat of voice.beats ?? []) {
          if (!(beat.notes?.length)) continue
          rates.push(beatOnsetRate(beat, bpm))
        }
      }
    }
  }
  if (rates.length === 0) return bpm
  rates.sort((a, b) => a - b)
  const idx = Math.floor(0.95 * (rates.length - 1))
  return rates[idx]
}

// ---------------------------------------------------------------------------
// Per-beat Difficulty Class (DC) and per-beat roll
// ---------------------------------------------------------------------------

// Baseline DC: a single quarter note, no jump, comfortable tempo. The player's
// effective dex is compared against the beat DC via a Bradley-Terry roll —
// chance = effectiveDex / (effectiveDex + DC). At parity, 50% chance.
export const DC_BASE = 60

export function beatDC(beat, prevNote = null, effectiveBpm = 120) {
  const notes = beat?.notes ?? []
  if (notes.length === 0) return 0

  const seconds = realDurationSeconds(beat.duration?.value, effectiveBpm)
  // 0 (very fast) … 1 (very long). Long notes are easy.
  const ease = Math.max(0, Math.min(1, (seconds - 0.05) / 0.35))

  let maxDistance = 0
  for (const note of notes) {
    const d = physicalDistance(prevNote, note)
    if (d > maxDistance) maxDistance = d
  }

  const distanceFactor = 1 + Math.max(0, maxDistance - 2) / 8
  const chordFactor = 1 + Math.max(0, notes.length - 1) * 0.35
  const speedFactor = 1 + (1 - ease) * 2

  return DC_BASE * distanceFactor * chordFactor * speedFactor
}

export function rollBeatAccuracy(effectiveDex, beat, prevNote = null, effectiveBpm = 120) {
  const notes = beat?.notes ?? []
  if (notes.length === 0) return { success: true, semitones: 0, lastNote: prevNote }

  let lastNote = prevNote
  for (const note of notes) lastNote = note

  const dc = beatDC(beat, prevNote, effectiveBpm)
  if (dc <= 0) return { success: true, semitones: 0, lastNote }

  // Bradley-Terry: ratio of stat to stat+DC. Naturally asymptotic — never
  // hits 0% nor 100%, so randomness is always preserved.
  const dex = Math.max(0, effectiveDex ?? 0)
  const chance = dex / (dex + dc)
  const success = Math.random() < chance

  const semitones = success
    ? 0
    : (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 3))

  return { success, semitones, lastNote }
}

// ---------------------------------------------------------------------------
// Endurance cost per beat
// ---------------------------------------------------------------------------

export function beatExhaustion(beat, prevNote = null, effectiveBpm = 120) {
  const notes = beat?.notes ?? []
  if (notes.length === 0) return 0

  const seconds = realDurationSeconds(beat.duration?.value, effectiveBpm)
  // Baseline: a quarter note at 120 BPM (0.5s) costs 1.0.
  const speedFactor = Math.sqrt(0.5 / Math.max(0.05, seconds))

  let maxDistance = 0
  for (const note of notes) {
    const d = physicalDistance(prevNote, note)
    if (d > maxDistance) maxDistance = d
  }
  const distanceFactor = 1 + Math.max(0, maxDistance - 2) / 12
  const chordFactor = 1 + Math.max(0, notes.length - 1) * 0.15

  return speedFactor * distanceFactor * chordFactor
}

// ---------------------------------------------------------------------------
// Score-level Difficulty Class (P95 over all beats at the raw score tempo)
// Used both for the library star badge and the muscle-memory growth modulator.
// ---------------------------------------------------------------------------

export function scoreDC(score, track = null) {
  if (!score) return DC_BASE
  const t = track ?? score.tracks?.[0]
  if (!t) return DC_BASE
  const bpm = score.tempo ?? 120

  const dcs = []
  let prevNote = null
  for (const staff of t.staves ?? []) {
    for (const bar of staff.bars ?? []) {
      for (const voice of bar.voices ?? []) {
        for (const beat of voice.beats ?? []) {
          if (!(beat.notes?.length)) continue
          const dc = beatDC(beat, prevNote, bpm)
          if (dc > 0) dcs.push(dc)
          for (const n of beat.notes) prevNote = n
        }
      }
    }
  }
  if (dcs.length === 0) return DC_BASE
  dcs.sort((a, b) => a - b)
  const idx = Math.floor(0.95 * (dcs.length - 1))
  return dcs[idx]
}

// ---------------------------------------------------------------------------
// Score analysis (display): map scoreDC to a 0..1 difficulty rating + meta
// ---------------------------------------------------------------------------

// A scoreDC at DC_BASE → 0 (trivial). Anything ≥ DC_BASE + 540 → 1 (max stars).
// 540 is roughly the spread between a baseline beat and a "shred" beat (chord
// of 3 sixteenth notes with octave jumps) at the same tempo.
const DC_DIFFICULTY_SPAN = 540

export function analyzeScore(score, track = null) {
  if (!score) return { estimatedDifficulty: 0.5, dc: DC_BASE, noteCount: 0, avgBpm: 120 }

  const t = track ?? score.tracks?.[0]
  if (!t) return { estimatedDifficulty: 0.5, dc: DC_BASE, noteCount: 0, avgBpm: 120 }

  let noteCount = 0
  for (const staff of t.staves ?? []) {
    for (const bar of staff.bars ?? []) {
      for (const voice of bar.voices ?? []) {
        for (const beat of voice.beats ?? []) {
          noteCount += beat.notes?.length ?? 0
        }
      }
    }
  }

  const dc = scoreDC(score, t)
  const estimatedDifficulty = Math.max(
    0,
    Math.min(1, (dc - DC_BASE) / DC_DIFFICULTY_SPAN),
  )
  return { estimatedDifficulty, dc, noteCount, avgBpm: score.tempo ?? 120 }
}
