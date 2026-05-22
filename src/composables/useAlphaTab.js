import { ref, watch, onUnmounted } from 'vue'
import * as alphaTab from '@coderline/alphatab'
import { useCharacterStore } from '@/stores/character'
import { useSettings } from '@/composables/useSettings'
import { rollBeatAccuracy, beatExhaustion, scoreOnsetRate } from '@/utils/rpgEngine'
import { findPlayableTrack, INSTRUMENT_META } from '@/utils/instruments'

export function useAlphaTab(containerRef) {
  const store = useCharacterStore()
  const { volume } = useSettings()
  const api = ref(null)
  const isReady = ref(false)
  const isPlaying = ref(false)
  const sessionStats = ref({ totalBeats: 0, successBeats: 0 })
  const sessionResult = ref(null)
  const loadError = ref(null)
  let playableTrack = null

  let currentTransposition = 0
  let nextOutcome = null    // outcome decided for the *next* beat to be played
  let lastPitch = 60        // last pitch resolved by a roll (for difficulty chaining)
  let playbackMultiplier = 1 // computed at scoreLoaded from speed stat vs score onset rate

  function applyTransposition(semitones) {
    if (!api.value || semitones === currentTransposition) return
    api.value.changeTrackTranspositionPitch(api.value.tracks, semitones)
    currentTransposition = semitones
  }

  function effectiveBpm() {
    return (api.value?.score?.tempo ?? 120) * playbackMultiplier
  }

  function preRoll(beat) {
    if (!beat) {
      nextOutcome = null
      applyTransposition(0)
      return
    }
    const roll = rollBeatAccuracy(store.accuracyThreshold, beat, lastPitch, effectiveBpm())
    lastPitch = roll.lastPitch
    nextOutcome = { success: roll.success, beat }
    applyTransposition(roll.success ? 0 : roll.semitones)
  }

  function firstBeatOfTrack(track) {
    return track?.staves?.[0]?.bars?.[0]?.voices?.[0]?.beats?.[0] ?? null
  }

  function endSession(outcome) {
    // outcome: 'completed' | 'stopped' | 'exhausted'
    if (!api.value) return
    if (sessionResult.value) return
    if (sessionStats.value.totalBeats === 0) return

    applyTransposition(0)
    nextOutcome = null
    api.value.stop()

    const accuracy = sessionStats.value.successBeats / sessionStats.value.totalBeats
    const title = api.value.score?.title || 'Unknown score'
    const beatCount = sessionStats.value.totalBeats

    const xpGained = store.applySessionXP({ title, accuracy, outcome, beatCount })

    sessionResult.value = {
      title,
      accuracy,
      outcome,
      beatCount,
      xpGained,
      tooShort: xpGained?.tooShort === true,
    }
    isPlaying.value = false
  }

  function init() {
    if (!containerRef.value) return

    api.value = new alphaTab.AlphaTabApi(containerRef.value, {
      core: {
        fontDirectory: '/font/',
      },
      player: {
        enablePlayer: true,
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        enableUserInteraction: false,
        soundFont: '/soundfont/sonivox.sf2',
        scrollElement: containerRef.value,
        scrollMode: alphaTab.ScrollMode.Continuous,
      },
      display: {
        layoutMode: alphaTab.LayoutMode.Horizontal,
      },
    })

    api.value.masterVolume = volume.value

    api.value.scoreLoaded.on(() => {
      const score = api.value.score
      const instrument = store.character.instrument
      const match = findPlayableTrack(score, instrument)

      if (!match) {
        const label = INSTRUMENT_META[instrument]?.label ?? instrument
        loadError.value = `No ${label} track in this score.`
        isReady.value = false
        api.value.stop()
        return
      }
      loadError.value = null
      playableTrack = match

      // Switch the renderer to the matched track if alphaTab defaulted to a
      // different one. This triggers a re-render of just that track.
      const alreadyRendered = api.value.tracks?.length === 1 && api.value.tracks[0] === match
      if (!alreadyRendered) {
        api.value.renderTracks([match])
      }

      // Mute every non-matched track for audio cleanup.
      const others = (score?.tracks ?? []).filter(t => t !== match)
      if (others.length) {
        api.value.changeTrackMute(others, true)
      }
      api.value.changeTrackSolo([match], true)

      // Derive playback tempo from character Speed vs the score's onset rate (P95)
      // computed on the matched track only.
      const onsetRate = scoreOnsetRate(score, match)
      playbackMultiplier = Math.min(1, store.character.speed / Math.max(1, onsetRate))
      api.value.playbackSpeed = playbackMultiplier
      api.value.masterVolume = volume.value
      isReady.value = true
      sessionStats.value = { totalBeats: 0, successBeats: 0 }
      sessionResult.value = null
      lastPitch = 60
      currentTransposition = 0
      nextOutcome = null
      store.resetStamina()
      // Pre-roll for the very first beat so the wrong pitch is already set
      // when audio begins.
      preRoll(firstBeatOfTrack(match))
    })

    api.value.playedBeatChanged.on((beat) => {
      if (!beat) return

      // The outcome for THIS beat was decided in the previous tick (pre-rolled).
      sessionStats.value.totalBeats++
      if (nextOutcome?.success) sessionStats.value.successBeats++

      // Stamina cost based on the played beat's actual difficulty.
      const cost = beatExhaustion(beat, lastPitch, effectiveBpm())
      store.spendNotes(cost)

      // Pre-roll for the next beat so its transposition is set before audio
      // plays. This avoids the synth pitch-bend slide.
      preRoll(beat.nextBeat)

      if (store.stamina <= 0) {
        endSession('exhausted')
      }
    })

    api.value.playerStateChanged.on(({ state }) => {
      isPlaying.value = state === alphaTab.synth.PlayerState.Playing
    })

    api.value.playerFinished.on(() => {
      endSession(store.stamina > 0 ? 'completed' : 'exhausted')
    })
  }

  const stopVolumeWatch = watch(volume, (v) => {
    if (api.value) api.value.masterVolume = v
  })

  function loadFile(file) {
    if (!api.value) return
    const reader = new FileReader()
    reader.onload = (e) => api.value.load(e.target.result)
    reader.readAsArrayBuffer(file)
  }

  function loadUrl(url) {
    if (!api.value) return
    api.value.load(url)
  }

  function playPause() {
    api.value?.playPause()
  }

  function stop() {
    endSession('stopped')
  }

  function rewind() {
    if (!api.value) return
    applyTransposition(0)
    api.value.stop()
    sessionStats.value = { totalBeats: 0, successBeats: 0 }
    lastPitch = 60
    nextOutcome = null
    preRoll(firstBeatOfTrack(playableTrack))
  }

  function clearLoadError() {
    loadError.value = null
  }

  function clearSessionResult() {
    sessionResult.value = null
  }

  onUnmounted(() => {
    stopVolumeWatch()
    api.value?.destroy()
  })

  return {
    init,
    loadFile,
    loadUrl,
    playPause,
    stop,
    rewind,
    clearSessionResult,
    clearLoadError,
    isReady,
    isPlaying,
    sessionStats,
    sessionResult,
    loadError,
  }
}
