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
import { usePlaylist, comfortFor, SPEED_MAX } from '@/composables/usePlaylist'
import { useRewards } from '@/composables/useRewards'

export function useAlphaTab(containerRef) {
  const store = useCharacterStore()
  const { volume, backingVolume } = useSettings()
  const playlist = usePlaylist()
  const rewards = useRewards()
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

  // alphaTab's playerFinished can fire more than once at the boundary of a
  // chained song transition (a queued event arriving after we've already
  // advanced). Dedupe with a short cooldown — anything below this window is
  // treated as the same finish event.
  let lastFinishedAt = 0
  const FINISH_DEDUPE_MS = 500

  // Prefer the playlist entry's manifest title (always set for built-in tabs)
  // over the score file's embedded title metadata (often missing).
  function currentSongTitle() {
    if (!currentTabId) return api.value?.score?.title || 'Unknown score'
    const entry = playlist.queue.value.find((t) => t.id === currentTabId)
    return entry?.title || api.value?.score?.title || 'Unknown score'
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
    const dex = effectiveDexFor(store.effectiveDexterity, currentFamiliarity) / currentOverSpeed
    const roll = rollBeatAccuracy(dex, beat, lastNote, effectiveBpm())
    lastNote = roll.lastNote
    nextOutcome = { success: roll.success, beat }
    applyTransposition(roll.success ? 0 : roll.semitones)
  }

  function firstBeatOfTrack(track) {
    return track?.staves?.[0]?.bars?.[0]?.voices?.[0]?.beats?.[0] ?? null
  }

  // Single song-end path. Called by playerFinished (completed/exhausted) and
  // by the Stop button. Records this song's XP + per-song summary into the
  // playlist's run accumulator, then either chains to the next song (the
  // playlist drives `selectTab` itself) or builds the result panel.
  function finishCurrentSong(outcome) {
    if (!api.value) return
    if (!playlist.isRunning.value) return

    api.value.stop()
    applyTransposition(0)
    nextOutcome = null
    isPlaying.value = false

    const beatCount = sessionStats.value.totalBeats
    const accuracy = beatCount > 0 ? sessionStats.value.successBeats / beatCount : 0
    const title = currentSongTitle()
    const aboveComfort = playbackMultiplier > currentComfortSpeed + 1e-6

    // Streak bonus for completed songs uses the next-step multiplier (this
    // completion would be the (consecutive+1)-th in a row).
    const bonusMultiplier = outcome === 'completed'
      ? playlist.pendingBonusMultiplier.value
      : 1

    // Apply XP to the character; the store handles the too-short case and
    // returns a zero-gain summary in that scenario.
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

    // If this completion clears the song's category for the first time, the
    // category's reward is granted now. The applied rewards are attached to
    // the song's run-entry so SessionResult can surface them.
    const claimedRewards = outcome === 'completed'
      ? rewards.checkClaimForTab(currentTabId)
      : []

    const status = playlist.recordSongAndStep({
      tabId: currentTabId,
      title,
      accuracy,
      beatCount,
      outcome,
      selectedSpeed: playbackMultiplier,
      comfortSpeed: currentComfortSpeed,
      aboveComfort,
      xpGained,
      recordDelta: xpGained?.recordDelta ?? null,
      claimedRewards,
    })

    if (status === 'finished') {
      sessionResult.value = playlist.aggregateResult({ outcome })
    }
    // status === 'chained' → playlist.recordSongAndStep already fired
    // selectTab(nextSong); scoreLoaded's autoplay rule will play it.
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
      currentComfortSpeed = comfortFor(store.effectiveSpeed, currentOnsetRate) ?? SPEED_MAX
      if (currentTabId) store.cacheTabOnsetRate(currentTabId, currentOnsetRate)

      // Resolve the selected speed for this load.
      // Find by tabId rather than by index — between runs (runIndex === -1)
      // the player may still be displaying queue[0] as a preview.
      const playlistEntry = currentTabId
        ? playlist.queue.value.find((t) => t.id === currentTabId)
        : null
      const selected = playlistEntry?.selectedSpeed ?? SPEED_MAX
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

      // Autoplay rule: if a run is active, play the just-loaded score. The
      // playlist's `runIndex >= 0` is the single signal that drives chaining
      // and replays — there is no separate flag to set or consume.
      if (playlist.isRunning.value) {
        // Defer one tick to give alphaTab time to settle internally.
        setTimeout(() => api.value?.play(), 0)
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
        finishCurrentSong('exhausted')
      }
    })

    api.value.playerStateChanged.on(({ state }) => {
      isPlaying.value = state === alphaTab.synth.PlayerState.Playing
    })

    api.value.playerFinished.on(() => {
      // Dedupe rapid double-fires at song-boundary (alphaTab can deliver a
      // queued playerFinished for the just-ended song *after* we've already
      // advanced to the next one).
      const now = Date.now()
      if (now - lastFinishedAt < FINISH_DEDUPE_MS) return
      lastFinishedAt = now

      if (!playlist.isRunning.value) return
      const outcome = store.stamina <= 0 ? 'exhausted' : 'completed'
      finishCurrentSong(outcome)
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

  // Live-react to slider movements on whichever tab is currently loaded so
  // pressing Play uses the freshest value. Disabled while a run is in
  // progress (the run drives playbackSpeed directly via scoreLoaded).
  const currentSelectedSpeed = computed(() => {
    if (!currentTabId) return null
    const entry = playlist.queue.value.find((t) => t.id === currentTabId)
    return entry?.selectedSpeed ?? null
  })
  const stopSpeedWatch = watch(currentSelectedSpeed, (v) => {
    if (v == null) return
    if (isPlaying.value) return
    if (playlist.isRunning.value) return
    playbackMultiplier = v
    currentOverSpeed = Math.max(1, v / Math.max(0.0001, currentComfortSpeed))
    if (api.value) api.value.playbackSpeed = v
  })

  // TODO: re-enable once Custom Score is unlocked as an end-game reward.
  // Currently no UI calls this — the file-drop branch is dormant pending a
  // completion-gated reintroduction (see plan in
  // ~/.claude/plans/2026-05-29-playlist-state-machine-refactor.md).
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

  // The single Play action. Used by both the Play and Replay buttons.
  // Starts a fresh run from index 0 every time — there is no "resume" or
  // "rewind" state to preserve, by design.
  function play() {
    if (!api.value) return
    if (playlist.length.value === 0) return
    sessionResult.value = null
    store.resetStamina()
    playlist.startRun()
    // playlist.startRun calls selectTab(queue[0]) → pendingScore → loadUrl
    // → api.value.load → scoreLoaded → autoplay (because isRunning is now
    // true). All downstream songs follow the same path via recordSongAndStep.
  }

  function stop() {
    if (!playlist.isRunning.value) return
    finishCurrentSong('stopped')
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
    clearSessionResult,
    clearLoadError,
    isReady,
    isPlaying,
    sessionStats,
    sessionResult,
    loadError,
  }
}
