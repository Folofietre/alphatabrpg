import { ref, watch, computed, onUnmounted } from 'vue'
import * as alphaTab from '@coderline/alphatab'
import { useCharacterStore } from '@/stores/character'
import { useSettings } from '@/composables/useSettings'
import {
  rollBeatAccuracy,
  beatExhaustion,
  scoreOnsetRate,
  scoreDC,
  effectiveDexFor,
} from '@/utils/rpgEngine'
import { findPlayableTrack, INSTRUMENT_META } from '@/utils/instruments'
import { usePlaylist, comfortFor, clampSpeed, SPEED_MAX } from '@/composables/usePlaylist'

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
  let playbackMultiplier = 1 // user-selected playback speed for the current run (0.20..1.00)
  let currentFamiliarity = 0 // snapshotted from tabRecords on scoreLoaded
  let currentDifficulty = null // P95 DC of the current score, forwarded to applySessionXP
  let currentOnsetRate = null  // P95 onset rate of the matched track, forwarded to applySessionXP
  let currentComfortSpeed = 1  // min(1, speed/onsetRate) — slider's "neutral" point
  let currentOverSpeed = 1     // max(1, selectedSpeed/comfortSpeed) — dex penalty divisor

  // Run-wide accumulator: per-song summaries and total XP gained across the
  // entire playlist run. Reset when a fresh run starts (via play() or the
  // Replay button). Drives the aggregate result panel at end-of-run.
  let runSongs = []
  let runXP = { speed: 0, dexterity: 0, endurance: 0, stretchSpeed: 0 }
  function resetRunAccumulator() {
    runSongs = []
    runXP = { speed: 0, dexterity: 0, endurance: 0, stretchSpeed: 0 }
  }
  function pushRunSong(entry) {
    runSongs.push(entry)
    if (entry.xpGained) {
      runXP.speed += entry.xpGained.speed ?? 0
      runXP.dexterity += entry.xpGained.dexterity ?? 0
      runXP.endurance += entry.xpGained.endurance ?? 0
      runXP.stretchSpeed += entry.xpGained.stretchSpeed ?? 0
    }
  }

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
    // Per-song muscle memory: shift the base dexterity by the current
    // familiarity for this tab (signed; penalty at 0, bonus near the cap).
    // Then divide by the over-speed factor — picking faster than your comfort
    // makes each beat harder.
    const dex = effectiveDexFor(store.character.dexterity, currentFamiliarity) / currentOverSpeed
    const roll = rollBeatAccuracy(dex, beat, lastNote, effectiveBpm())
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

    const aboveComfort = playbackMultiplier > currentComfortSpeed + 1e-6
    const xpGained = store.applySessionXP({
      tabId: currentTabId,
      title,
      accuracy,
      outcome: 'completed',
      beatCount,
      bonusMultiplier,
      playbackMultiplier,
      difficulty: currentDifficulty,
      onsetRate: currentOnsetRate,
      aboveComfort,
    })

    pushRunSong({
      title,
      accuracy,
      beatCount,
      outcome: 'completed',
      selectedSpeed: playbackMultiplier,
      aboveComfort,
      xpGained,
      recordDelta: xpGained?.recordDelta ?? null,
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

    const aboveComfort = playbackMultiplier > currentComfortSpeed + 1e-6
    const xpGained = store.applySessionXP({
      tabId: currentTabId,
      title,
      accuracy,
      outcome,
      beatCount,
      bonusMultiplier,
      playbackMultiplier,
      difficulty: currentDifficulty,
      onsetRate: currentOnsetRate,
      aboveComfort,
    })

    pushRunSong({
      title,
      accuracy,
      beatCount,
      outcome,
      selectedSpeed: playbackMultiplier,
      aboveComfort,
      xpGained,
      recordDelta: xpGained?.recordDelta ?? null,
    })

    // Build the result panel from the run accumulator. For a single-song run
    // this collapses to the previous per-song shape; for a multi-song run it
    // aggregates beats + XP across every attempted song.
    const songs = runSongs.slice()
    const isMulti = songs.length > 1
    const totalBeats = songs.reduce((s, x) => s + (x.beatCount || 0), 0)
    const totalSuccess = songs.reduce(
      (s, x) => s + (x.beatCount || 0) * (x.accuracy ?? 0),
      0,
    )
    const aggAccuracy = totalBeats > 0 ? totalSuccess / totalBeats : 0
    // Surface the last PB the run produced (if any) for the celebration line.
    let lastPB = null
    for (const s of songs) {
      if (s.recordDelta?.scorePB) lastPB = s.recordDelta
    }

    sessionResult.value = {
      tabId: currentTabId,
      title: isMulti ? 'Playlist run' : title,
      accuracy: aggAccuracy,
      outcome,
      beatCount: totalBeats,
      xpGained: isMulti ? { ...runXP } : xpGained,
      // For multi runs, surface the latest PB so the celebration line can fire;
      // SessionResult hides the comfort row (which is per-song) in this mode.
      recordDelta: isMulti ? lastPB : (xpGained?.recordDelta ?? null),
      bonusMultiplier: bonusMultiplier !== 1 ? bonusMultiplier : undefined,
      // "Too short" only applies when the entire run fell below the floor.
      tooShort: totalBeats < 10,
      playlistFinished: playlist.isRunning.value && outcome === 'completed',
      // Per-song speed details only make sense on single-song runs; for
      // playlist aggregates they live inside each `songs[]` entry instead.
      selectedSpeed: isMulti ? null : playbackMultiplier,
      comfortSpeed: isMulti ? null : currentComfortSpeed,
      aboveComfort: isMulti ? false : aboveComfort,
      songs: isMulti ? songs : null,
      lastPB,
      songsCompletedCount: songs.filter((s) => s.outcome === 'completed').length,
      songsAttemptedCount: songs.length,
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
        fontDirectory: `${import.meta.env.BASE_URL}font/`,
      },
      player: {
        enablePlayer: true,
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        enableUserInteraction: false,
        soundFont: `${import.meta.env.BASE_URL}soundfont/sonivox.sf2`,
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

      // Compute the song's onset rate (P95) and the player's comfort speed.
      // Cache the onset rate on the tabRecord so the *next* time this tab is
      // queued, the playlist seeds the slider to comfort instead of 100%.
      currentOnsetRate = scoreOnsetRate(score, match)
      currentComfortSpeed = comfortFor(store.character.speed, currentOnsetRate) ?? SPEED_MAX
      if (currentTabId) store.cacheTabOnsetRate(currentTabId, currentOnsetRate)

      const playlistEntry = currentTabId
        ? playlist.queue.value[playlist.currentIndex.value]
        : null
      let selected = playlistEntry?.selectedSpeed
      if (currentTabId && playlistEntry) {
        if (selected == null) {
          // Defensive fallback — append() always seeds a value, so we should
          // never hit this path in practice.
          selected = SPEED_MAX
          playlist.resolveSelectedSpeed(playlist.currentIndex.value, selected)
        }
      } else {
        // File drop / no playlist entry — default to 100% (full experience).
        selected = SPEED_MAX
      }
      playbackMultiplier = selected
      currentOverSpeed = Math.max(1, selected / Math.max(0.0001, currentComfortSpeed))
      api.value.playbackSpeed = playbackMultiplier
      api.value.masterVolume = volume.value

      // Snapshot per-tab muscle memory + score DC for the upcoming run.
      // Use the cached DC from the record if available, otherwise compute via
      // scoreDC (the result is persisted on first session via recordTabSession).
      const record = currentTabId ? store.tabRecords?.[currentTabId] : null
      currentFamiliarity = record?.familiarity ?? 0
      currentDifficulty = record?.dc ?? scoreDC(score, match)

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
          if (!isPlaying.value) play()
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

  // Live-react to the slider for the currently-loaded tab. While not playing,
  // we keep playbackMultiplier / overSpeed in sync so pressing Play uses the
  // freshest selection. The slider is locked during runs anyway.
  const currentSelectedSpeed = computed(() => {
    const idx = playlist.currentIndex.value
    return playlist.queue.value[idx]?.selectedSpeed ?? null
  })
  const stopSpeedWatch = watch(currentSelectedSpeed, (v) => {
    if (v == null) return
    if (isPlaying.value) return
    playbackMultiplier = v
    currentOverSpeed = Math.max(1, v / Math.max(0.0001, currentComfortSpeed))
    if (api.value) api.value.playbackSpeed = v
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

  // Start playback. No-op when already playing. There is no pause action by
  // design: the only way to interrupt a session is Stop.
  function play() {
    if (!api.value) return
    if (isPlaying.value) return

    // If the result panel from a previous run is still on screen, treat Play
    // as an implicit Replay. Otherwise endSession() would early-return on the
    // next outcome ("sessionResult already set") and the panel would never
    // update.
    if (sessionResult.value) {
      sessionResult.value = null
      store.resetStamina()
      if (playlist.length.value > 1) {
        // Multi-song queue: restart from index 0. restart() arms autoPlay,
        // which makes the first scoreLoaded callback play() automatically —
        // nothing else to do here.
        resetRunAccumulator()
        playlist.restart()
        return
      }
      // Single song — rewind and fall through to a normal play below.
      rewind()
    }

    if (playlist.length.value > 0 && !playlist.isRunning.value) {
      store.resetStamina()
      resetRunAccumulator()
      playlist.markRunStarted()
    }
    api.value.play()
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
    stopSpeedWatch()
    api.value?.destroy()
  })

  return {
    init,
    loadFile,
    loadUrl,
    play,
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
