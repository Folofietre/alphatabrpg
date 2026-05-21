export function rollNoteAccuracy(dexterity, note, prevPitch = 60) {
  const pitch = note.realValue ?? note.value ?? 60
  const interval = Math.abs(pitch - prevPitch)

  const difficulty = Math.min(1.0, interval / 12 + (note.duration?.value > 8 ? 0.2 : 0))
  const threshold = dexterity - difficulty * 0.4

  const roll = Math.random()
  const success = roll < threshold

  const semitones = success ? 0 : (Math.random() > 0.5 ? 1 : -1) * Math.ceil(Math.random() * 3)

  return { success, semitones }
}

export function fatiguePerBeat(endurance, bpm = 120) {
  const baseCost = 0.003
  const tempoFactor = bpm / 120
  return baseCost * tempoFactor * (1 - endurance * 0.6)
}

export function analyzeScore(score) {
  if (!score) return { estimatedDifficulty: 0.5, noteCount: 0, avgBpm: 120 }

  const track = score.tracks?.[0]
  if (!track) return { estimatedDifficulty: 0.5, noteCount: 0, avgBpm: 120 }

  let noteCount = 0
  let maxInterval = 0
  let prevPitch = 60

  for (const staff of track.staves ?? []) {
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
