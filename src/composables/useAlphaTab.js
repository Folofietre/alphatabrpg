import { ref, watch, onUnmounted } from 'vue'
import * as alphaTab from '@coderline/alphatab'
import { useCharacterStore } from '@/stores/character'
import { useSettings } from '@/composables/useSettings'
import { rollNoteAccuracy, fatiguePerBeat } from '@/utils/rpgEngine'

export function useAlphaTab(containerRef) {
  const store = useCharacterStore()
  const { volume } = useSettings()
  const api = ref(null)
  const isReady = ref(false)
  const isPlaying = ref(false)
  const sessionStats = ref({ totalBeats: 0, successBeats: 0 })
  const sessionResult = ref(null)
  let prevPitch = 60

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

    let currentTransposition = 0
    function applyTransposition(semitones) {
      if (semitones === currentTransposition) return
      api.value.changeTrackTranspositionPitch(api.value.tracks, semitones)
      currentTransposition = semitones
    }

    api.value.scoreLoaded.on(() => {
      api.value.playbackSpeed = store.playbackSpeed
      api.value.masterVolume = volume.value
      isReady.value = true
      sessionStats.value = { totalBeats: 0, successBeats: 0 }
      sessionResult.value = null
      prevPitch = 60
      currentTransposition = 0
      store.resetFatigue()
    })

    api.value.playedBeatChanged.on((beat) => {
      if (!beat) return
      sessionStats.value.totalBeats++

      let beatSemitones = 0
      let beatFailed = false

      for (const note of beat.notes ?? []) {
        const { success, semitones } = rollNoteAccuracy(store.accuracyThreshold, note, prevPitch)
        if (success) {
          sessionStats.value.successBeats++
        } else {
          beatFailed = true
          if (semitones !== 0 && beatSemitones === 0) beatSemitones = semitones
        }
        prevPitch = note.realValue ?? note.value ?? prevPitch
      }

      applyTransposition(beatFailed ? beatSemitones : 0)

      const bpm = api.value.score?.tempo ?? 120
      store.drainFatigue(fatiguePerBeat(store.character.endurance, bpm))

      if (store.fatigue <= 0) {
        api.value.pause()
        isPlaying.value = false
      }
    })

    api.value.playerStateChanged.on(({ state }) => {
      isPlaying.value = state === alphaTab.synth.PlayerState.Playing
    })

    api.value.playerFinished.on(() => {
      applyTransposition(0)
      const accuracy = sessionStats.value.totalBeats > 0
        ? sessionStats.value.successBeats / sessionStats.value.totalBeats
        : 0
      const completed = store.fatigue > 0
      const title = api.value.score?.title || 'Unknown score'
      const beatCount = sessionStats.value.totalBeats

      const before = { ...store.character }
      store.applySessionXP({ title, accuracy, completed, beatCount })
      const after = store.character
      sessionResult.value = {
        title,
        accuracy,
        completed,
        beatCount,
        xpGained: {
          speed: after.speed - before.speed,
          dexterity: after.dexterity - before.dexterity,
          endurance: after.endurance - before.endurance,
        },
      }
      isPlaying.value = false
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
    if (!api.value) return
    api.value.changeTrackTranspositionPitch(api.value.tracks, 0)
    api.value.stop()
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
    clearSessionResult,
    isReady,
    isPlaying,
    sessionStats,
    sessionResult,
  }
}
