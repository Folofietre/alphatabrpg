import { ref, watch, onUnmounted } from 'vue'
import * as alphaTab from '@coderline/alphatab'
import { useCharacterStore } from '@/stores/character'
import { useSettings } from '@/composables/useSettings'
import { rollBeatAccuracy, beatExhaustion, scoreOnsetRate } from '@/utils/rpgEngine'
import { findPlayableTrack, INSTRUMENT_META } from '@/utils/instruments'
import { usePlaylist } from '@/composables/usePlaylist'

export function useAlphaTab(containerRef) {
  const store = useCharacterStore()
  const { volume, backingVolume } = useSettings()
  const playlist = usePlaylist()
  const api = ref(null)
  const isReady = ref(false)
  const isPlaying = ref(false)
  const sessionStats = ref({ totalBeats: 0, successBeats: 0 })
  const sessionResult = ref(null)
  const loadError = ref(null)
  let playableTrack = null
  let currentTabId = null     // tab id of the score being loaded/played (null for file drops)

  let currentTransposition = 0
  let nextOutcome = null    // outcome decided for the *next* beat to be played
  let lastNote = null       // last Note resolved by a roll (drives physicalDistance chaining)
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
    const roll = rollBeatAccuracy(store.accuracyThreshold, beat, lastNote, effectiveBpm())
    lastNote = roll.lastNote
    nextOutcome = { success: roll.success, beat }
    applyTransposition(roll.success ? 0 : roll.semitones)
  }

  function firstBeatOfTrack(track) {
    return track?.staves?.[0]?.bars?.[0]?.voices?.[0]?.beats?.[0] ?? null
  }

  // Apply XP for the current song and silently advance the playlist (no result
  // panel). Used by the chain path when the player has just completed a song
  // and another one is queued.
  function recordAndAdvance(bonusMultiplier) {
    if (!api.value) return

    // Force the player into Paused state so the ScorePlayer's pendingScore
    // watch isn't blocked by its `if (isPlaying) return` guard when the next
    // tab is queued. alphaTab fires playerStateChanged but with a delay.
    isPlaying.value = false
    api.value.stop()
    applyTransposition(0)
    nextOutcome = null

    if (sessionStats.value.totalBeats === 0) {
      // Nothing meaningful happened; still try to advance.
      playlist.onSongCompleted()
      return
    }

    const accuracy = sessionStats.value.successBeats / sessionStats.value.totalBeats
    const title = api.value.score?.title || 'Unknown score'
    const beatCount = sessionStats.value.totalBeats

    store.applySessionXP({
      tabId: currentTabId,
      title,
      accuracy,
      outcome: 'completed',
      beatCount,
      bonusMultiplier,
    })

    // Advance — onSongCompleted internally triggers the next-load via
    // useTabSelection and arms the auto-play flag.
    playlist.onSongCompleted()
  }

  function endSession(outcome, { bonusMultiplier = 1 } = {}) {
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

    const xpGained = store.applySessionXP({
      tabId: currentTabId,
      title,
      accuracy,
      outcome,
      beatCount,
      bonusMultiplier,
    })

    sessionResult.value = {
      tabId: currentTabId,
      title,
      accuracy,
      outcome,
      beatCount,
      xpGained,
      bonusMultiplier: bonusMultiplier !== 1 ? bonusMultiplier : undefined,
      tooShort: xpGained?.tooShort === true,
      playlistFinished: playlist.isRunning.value && outcome === 'completed',
    }
    isPlaying.value = false

    // Tear down the playlist run on any non-chained outcome.
    if (outcome !== 'completed' && playlist.isRunning.value) {
      playlist.onRunAborted()
    }
    if (outcome === 'completed' && playlist.isRunning.value) {
      // Final song completed; flip isRunning off via onSongCompleted (no next).
      playlist.onSongCompleted()
    }
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

      // Played track at full volume; the rest plays as a backing band at the
      // user-configurable backingVolume setting.
      const others = (score?.tracks ?? []).filter((t) => t !== match)
      // Reset any previous solo/mute state in case we re-load a score.
      api.value.changeTrackSolo(score?.tracks ?? [], false)
      api.value.changeTrackMute(score?.tracks ?? [], false)
      api.value.changeTrackVolume([match], 1.0)
      if (others.length) {
        api.value.changeTrackVolume(others, backingVolume.value)
      }

      // Derive playback tempo from character Speed vs the score's onset rate (P95)
      // computed on the matched track only.
      const onsetRate = scoreOnsetRate(score, match)
      playbackMultiplier = Math.min(1, store.character.speed / Math.max(1, onsetRate))
      api.value.playbackSpeed = playbackMultiplier
      api.value.masterVolume = volume.value
      isReady.value = true
      sessionStats.value = { totalBeats: 0, successBeats: 0 }
      sessionResult.value = null
      lastNote = null
      currentTransposition = 0
      nextOutcome = null
      // Stamina persists across an active playlist run — reset only when not
      // already running through a chained sequence.
      if (!playlist.isRunning.value) {
        store.resetStamina()
      }
      // Pre-roll for the very first beat so the wrong pitch is already set
      // when audio begins.
      preRoll(firstBeatOfTrack(match))

      // If this load was chained from a previous song's completion (or from a
      // playlist restart via Replay), start playing immediately without
      // requiring a user click.
      if (playlist.consumeAutoPlay()) {
        // Defer one tick to give alphaTab time to settle internally.
        setTimeout(() => {
          if (!isPlaying.value) playPause()
        }, 0)
      }
    })

    api.value.playedBeatChanged.on((beat) => {
      if (!beat) return

      // The outcome for THIS beat was decided in the previous tick (pre-rolled).
      sessionStats.value.totalBeats++
      if (nextOutcome?.success) sessionStats.value.successBeats++

      // Stamina cost based on the played beat's actual difficulty.
      const cost = beatExhaustion(beat, lastNote, effectiveBpm())
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
      const exhausted = store.stamina <= 0
      if (exhausted) {
        endSession('exhausted')
        return
      }
      // Completed. If a playlist run is active and a next tab is queued,
      // silently record + advance (no result panel, auto-play next). Otherwise
      // surface the panel.
      if (playlist.isRunning.value && playlist.hasNext.value) {
        const bonus = playlist.pendingBonusMultiplier.value
        recordAndAdvance(bonus)
        return
      }
      const finalBonus = playlist.isRunning.value
        ? playlist.pendingBonusMultiplier.value
        : 1
      endSession('completed', { bonusMultiplier: finalBonus })
    })
  }

  const stopVolumeWatch = watch(volume, (v) => {
    if (api.value) api.value.masterVolume = v
  })

  // Live re-apply when the user moves the backing-volume slider mid-session.
  const stopBackingWatch = watch(backingVolume, (v) => {
    if (!api.value || !playableTrack) return
    const others = (api.value.score?.tracks ?? []).filter((t) => t !== playableTrack)
    if (others.length) api.value.changeTrackVolume(others, v)
  })

  function loadFile(file) {
    if (!api.value) return
    currentTabId = null
    const reader = new FileReader()
    reader.onload = (e) => api.value.load(e.target.result)
    reader.readAsArrayBuffer(file)
  }

  function loadUrl(url, tabId = null) {
    if (!api.value) return
    currentTabId = tabId
    api.value.load(url)
  }

  function playPause() {
    if (!api.value) return
    // Starting from a paused state with a queued playlist marks the start of
    // a new run (stamina resets here so the first song of the run has full
    // stamina, but subsequent chained songs do not).
    const isStarting = !isPlaying.value
    if (isStarting && playlist.length.value > 0 && !playlist.isRunning.value) {
      store.resetStamina()
      playlist.markRunStarted()
    }
    api.value.playPause()
  }

  function stop() {
    endSession('stopped')
  }

  function rewind() {
    if (!api.value) return
    applyTransposition(0)
    api.value.stop()
    sessionStats.value = { totalBeats: 0, successBeats: 0 }
    lastNote = null
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
    stopBackingWatch()
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
