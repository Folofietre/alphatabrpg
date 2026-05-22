// Physical "distance" between two notes for difficulty modeling.
// On a fretted instrument the cost of moving is dominated by the fret jump
// (your hand changes position) with a smaller contribution from string skips
// (your finger crosses strings without moving your hand). On instruments
// without TAB data (piano, raw MIDI) we fall back to the absolute MIDI
// interval, which is a reasonable proxy for hand travel on a keyboard.
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

function realDurationSeconds(durationValue, effectiveBpm) {
  const v = durationValue ?? 4
  const quarterSeconds = 60 / Math.max(1, effectiveBpm)
  return v < 0
    ? quarterSeconds * 4 * Math.abs(v)
    : quarterSeconds * (4 / Math.max(1, v))
}

// Onsets per minute for a single beat at a given (raw) score tempo.
function beatOnsetRate(beat, bpm) {
  const v = beat.duration?.value ?? 4
  const factor = v < 0 ? 1 / (4 * Math.abs(v)) : v / 4
  return bpm * factor
}

// 95th percentile of onset rates across beats with notes. Used to derive the
// playback multiplier given the character's Speed stat. When `track` is not
// provided, falls back to the first track of the score.
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

export function rollBeatAccuracy(dexterity, beat, prevNote = null, effectiveBpm = 120) {
  const notes = beat.notes ?? []
  if (notes.length === 0) return { success: true, semitones: 0, lastNote: prevNote }

  const seconds = realDurationSeconds(beat.duration?.value, effectiveBpm)
  const ease = Math.max(0, Math.min(1, (seconds - 0.05) / 0.35))

  let maxDistance = 0
  let lastNote = prevNote
  for (const note of notes) {
    const d = physicalDistance(prevNote, note)
    if (d > maxDistance) maxDistance = d
    lastNote = note
  }

  // Distances ≤ 2 are free (local position shifts on a fretboard, ≤ 2 semitones
  // on a keyboard). Beyond that, penalty scales linearly and caps at 0.4.
  const distancePenalty = Math.min(0.4, Math.max(0, maxDistance - 2) / 30)
  const chordPenalty = Math.max(0, notes.length - 1) * 0.08
  const speedPenalty = (1 - ease) * 0.45

  const skill = Math.min(1, dexterity + ease * 0.5)
  const threshold = skill - distancePenalty - chordPenalty - speedPenalty

  const success = Math.random() < threshold
  const semitones = success
    ? 0
    : (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 3))

  return { success, semitones, lastNote }
}

export function beatExhaustion(beat, prevNote = null, effectiveBpm = 120) {
  const notes = beat.notes ?? []
  if (notes.length === 0) return 0

  const seconds = realDurationSeconds(beat.duration?.value, effectiveBpm)
  // Baseline: a quarter note at 120 BPM (0.5s) costs 1.0.
  // Faster notes cost more, longer notes cost less. Sqrt softens the curve.
  const speedFactor = Math.sqrt(0.5 / Math.max(0.05, seconds))

  let maxDistance = 0
  for (const note of notes) {
    const d = physicalDistance(prevNote, note)
    if (d > maxDistance) maxDistance = d
  }
  // Distances up to 2 are free; 12 (a full hand jump) roughly doubles cost.
  const distanceFactor = 1 + Math.max(0, maxDistance - 2) / 12

  // Each extra note in a chord adds 15%.
  const chordFactor = 1 + Math.max(0, notes.length - 1) * 0.15

  return speedFactor * distanceFactor * chordFactor
}

// Heuristic 0..1 difficulty for a score, optionally scoped to a specific track.
// Considers tempo, biggest physical jump between notes, and total note count.
export function analyzeScore(score, track = null) {
  if (!score) return { estimatedDifficulty: 0.5, noteCount: 0, avgBpm: 120 }

  const t = track ?? score.tracks?.[0]
  if (!t) return { estimatedDifficulty: 0.5, noteCount: 0, avgBpm: 120 }

  let noteCount = 0
  let maxDistance = 0
  let prevNote = null

  for (const staff of t.staves ?? []) {
    for (const bar of staff.bars ?? []) {
      for (const voice of bar.voices ?? []) {
        for (const beat of voice.beats ?? []) {
          for (const note of beat.notes ?? []) {
            const d = physicalDistance(prevNote, note)
            if (d > maxDistance) maxDistance = d
            prevNote = note
            noteCount++
          }
        }
      }
    }
  }

  const avgBpm = score.tempo ?? 120
  // Distance normalisation: 24 was the old "octave x2" reference for MIDI
  // intervals; in fretboard units, 24 ≈ "two full hand jumps + a string skip"
  // — still a sensible difficulty ceiling.
  const estimatedDifficulty = Math.min(
    1.0,
    (avgBpm / 200) * 0.4 + (maxDistance / 24) * 0.4 + (noteCount / 500) * 0.2,
  )

  return { estimatedDifficulty, noteCount, avgBpm }
}
