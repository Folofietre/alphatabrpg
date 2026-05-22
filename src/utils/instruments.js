// MIDI GM program ranges for the instruments the game supports.
export const INSTRUMENT_RANGES = {
  piano:  [0, 7],
  guitar: [24, 31],
  bass:   [32, 39],
}

export const SUPPORTED_INSTRUMENTS = ['piano', 'guitar', 'bass']

// Order matters: drives the character-picker layout. `disabled` entries are
// shown but cannot be selected.
export const PICKER_INSTRUMENTS = ['piano', 'guitar', 'bass', 'drums']

const BASE = import.meta.env.BASE_URL

export const INSTRUMENT_META = {
  piano: {
    label: 'Piano',
    symbol: '🎹',
    tagline: 'Classic experience — can also play guitar tracks.',
    avatar: `${BASE}avatar/piano.png`,
  },
  guitar: {
    label: 'Guitar',
    symbol: '🎸',
    tagline: 'Plays guitar tracks only.',
    avatar: `${BASE}avatar/guitar.png`,
  },
  bass: {
    label: 'Bass',
    symbol: '🪕',
    tagline: 'Plays bass tracks only.',
    avatar: `${BASE}avatar/bass.png`,
  },
  drums: {
    label: 'Drummer',
    symbol: '🥁',
    tagline: 'Coming in a future update.',
    avatar: `${BASE}avatar/drums.png`,
    disabled: true,
  },
}

// Classify a track via its MIDI program / percussion flag.
export function instrumentOf(track) {
  if (!track) return 'other'
  if (track.isPercussion || track.playbackInfo?.primaryChannel === 9) return 'drums'
  const program = track.playbackInfo?.program
  if (program == null) return 'other'
  if (program >= INSTRUMENT_RANGES.piano[0]  && program <= INSTRUMENT_RANGES.piano[1])  return 'piano'
  if (program >= INSTRUMENT_RANGES.guitar[0] && program <= INSTRUMENT_RANGES.guitar[1]) return 'guitar'
  if (program >= INSTRUMENT_RANGES.bass[0]   && program <= INSTRUMENT_RANGES.bass[1])   return 'bass'
  return 'other'
}

// Resolve which track the given player should play in this score.
// Rules:
//   guitar → first guitar track
//   bass   → first bass track
//   piano  → first piano track, else first guitar track (piano is the "classic" experience)
// Returns null if nothing matches.
export function findPlayableTrack(score, playerInstrument) {
  const tracks = score?.tracks ?? []
  if (tracks.length === 0) return null

  const firstOf = (kind) => tracks.find(t => instrumentOf(t) === kind) ?? null

  if (playerInstrument === 'guitar') return firstOf('guitar')
  if (playerInstrument === 'bass')   return firstOf('bass')
  if (playerInstrument === 'piano')  return firstOf('piano') ?? firstOf('guitar')
  return null
}

export function scoreIsPlayable(score, playerInstrument) {
  return findPlayableTrack(score, playerInstrument) !== null
}
