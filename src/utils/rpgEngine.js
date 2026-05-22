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

export function rollBeatAccuracy(dexterity, beat, prevPitch = 60, effectiveBpm = 120) {
  const notes = beat.notes ?? []
  if (notes.length === 0) return { success: true, semitones: 0, lastPitch: prevPitch }

  const seconds = realDurationSeconds(beat.duration?.value, effectiveBpm)
  const ease = Math.max(0, Math.min(1, (seconds - 0.05) / 0.35))

  let maxInterval = 0
  let lastPitch = prevPitch
  for (const note of notes) {
    const p = note.realValue ?? note.value ?? prevPitch
    maxInterval = Math.max(maxInterval, Math.abs(p - prevPitch))
    lastPitch = p
  }

  const intervalPenalty = Math.min(0.4, Math.max(0, maxInterval - 2) / 30)
  const chordPenalty = Math.max(0, notes.length - 1) * 0.08
  const speedPenalty = (1 - ease) * 0.45

  const skill = Math.min(1, dexterity + ease * 0.5)
  const threshold = skill - intervalPenalty - chordPenalty - speedPenalty

  const success = Math.random() < threshold
  const semitones = success
    ? 0
    : (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 3))

  return { success, semitones, lastPitch }
}

export function beatExhaustion(beat, prevPitch = 60, effectiveBpm = 120) {
  const notes = beat.notes ?? []
  if (notes.length === 0) return 0

  const seconds = realDurationSeconds(beat.duration?.value, effectiveBpm)
  // Baseline: a quarter note at 120 BPM (0.5s) costs 1.0.
  // Faster notes cost more, longer notes cost less. Sqrt softens the curve.
  const speedFactor = Math.sqrt(0.5 / Math.max(0.05, seconds))

  let maxInterval = 0
  for (const note of notes) {
    const p = note.realValue ?? note.value ?? prevPitch
    maxInterval = Math.max(maxInterval, Math.abs(p - prevPitch))
  }
  // Intervals up to 2 semitones are free; an octave roughly doubles the cost.
  const intervalFactor = 1 + Math.max(0, maxInterval - 2) / 12

  // Each extra note in a chord adds 15%.
  const chordFactor = 1 + Math.max(0, notes.length - 1) * 0.15

  return speedFactor * intervalFactor * chordFactor
}

// Heuristic 0..1 difficulty for a score, optionally scoped to a specific track.
// Considers tempo, biggest pitch interval, and total note count.
export function analyzeScore(score, track = null) {
  if (!score) return { estimatedDifficulty: 0.5, noteCount: 0, avgBpm: 120 }

  const t = track ?? score.tracks?.[0]
  if (!t) return { estimatedDifficulty: 0.5, noteCount: 0, avgBpm: 120 }

  let noteCount = 0
  let maxInterval = 0
  let prevPitch = 60

  for (const staff of t.staves ?? []) {
    for (const bar of staff.bars ?? []) {
      for (const voice of bar.voices ?? []) {
        for (const beat of voice.beats ?? []) {
          for (const note of beat.notes ?? []) {
            const pitch = note.realValue ?? note.value ?? 60
            maxInterval = Math.max(maxInterval, Math.abs(pitch - prevPitch))
            prevPitch = pitch
            noteCount++
          }
        }
      }
    }
  }

  const avgBpm = score.tempo ?? 120
  const estimatedDifficulty = Math.min(
    1.0,
    (avgBpm / 200) * 0.4 + (maxInterval / 24) * 0.4 + (noteCount / 500) * 0.2,
  )

  return { estimatedDifficulty, noteCount, avgBpm }
}
