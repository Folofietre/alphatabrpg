<template>
  <section class="score-player">
    <div ref="playerContainer" class="alphatab-host" />

    <p v-if="loadError" class="load-error">{{ loadError }}</p>

    <div v-if="isReady && !sessionResult" class="controls">
      <div class="fatigue">
        <label>Stamina</label>
        <progress :value="store.stamina" max="1" />
        <span class="fatigue-value">{{ Math.round(store.stamina * 100) }}%</span>
      </div>
    </div>

    <SessionResult
      v-if="sessionResult"
      :result="sessionResult"
      :playlist-length="playlistLength"
      @replay="onReplay"
    />
  </section>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useAlphaTab } from '@/composables/useAlphaTab'
import { useCharacterStore } from '@/stores/character'
import { useTabSelection } from '@/composables/useTabSelection'
import { usePlaybackLock } from '@/composables/usePlaybackLock'
import { usePlaylist } from '@/composables/usePlaylist'
import { usePlayerActions } from '@/composables/usePlayerActions'
import SessionResult from './SessionResult.vue'

const playerContainer = ref(null)
const store = useCharacterStore()
const {
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
  sessionResult,
  loadError,
} = useAlphaTab(playerContainer)

const { pendingScore } = useTabSelection()
const { setPlaying } = usePlaybackLock()
const playlist = usePlaylist()
const playerActions = usePlayerActions()
const playlistLength = computed(() => playlist.length.value)

onMounted(() => {
  init()
  // Expose play/stop to other components (PlaylistColumn).
  playerActions.register({ play, stop })
})
onBeforeUnmount(() => {
  playerActions.unregister()
})

watch(isPlaying, (v) => setPlaying(v))

watch(pendingScore, (score) => {
  if (!score) return
  if (isPlaying.value) return // locked: can't switch while playing
  clearSessionResult()
  clearLoadError()
  if (score.kind === 'url') loadUrl(score.url, score.tabId ?? null)
  else if (score.kind === 'file') loadFile(score.file)
})

function onReplay() {
  clearSessionResult()
  store.resetStamina()
  if (playlistLength.value > 1) {
    // Multi-song run: restart playlist from the top. restart() calls
    // selectTab → pendingScore fires → loadUrl runs → scoreLoaded auto-plays.
    playlist.restart()
  } else {
    rewind()
    play()
  }
}
</script>

<style scoped>
.score-player {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.alphatab-host {
  width: 100%;
  height: 420px;
  background: var(--bg-surface);
  color: var(--ash-brown);
  border-radius: 0.5rem;
  border: 1px solid var(--panel-border);
  overflow-x: auto;
  overflow-y: auto;
}
.alphatab-host :deep(.at-surface) {
  color: var(--ash-brown);
}
.alphatab-host :deep(.at-cursor-bar) {
  background: rgba(173, 193, 120, 0.32); /* muted-olive translucent */
}
.alphatab-host :deep(.at-cursor-beat) {
  background: var(--faded-copper);
  width: 3px;
}
.alphatab-host :deep(.at-selection div) {
  background: rgba(123, 143, 75, 0.18);
}
.alphatab-host :deep(.at-highlight) * {
  fill: var(--palm-leaf);
  stroke: var(--palm-leaf);
}
.controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.fatigue {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 240px;
}
.fatigue progress {
  flex: 1;
  height: 18px;
}
.fatigue-value {
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  opacity: 0.8;
}
.load-error {
  margin: 0;
  padding: 0.6rem 0.85rem;
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  border-radius: 0.4rem;
  color: var(--ash-brown);
  font-size: 0.9rem;
}
</style>
