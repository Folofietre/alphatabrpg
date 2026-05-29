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
  // No isPlaying guard here: every selectTab caller is either guarded by
  // !isRunning at its source (append/removeAt/onReplay) or is the chained
  // playlist transition path that explicitly *wants* to swap scores even
  // though alphaTab's isPlaying state may still read stale=true from a
  // queued playerStateChanged event. The UI-level lock (TabLibrary disabling
  // tabs during playback via usePlaybackLock) is what enforces "no manual
  // switching mid-run".
  clearSessionResult()
  clearLoadError()
  if (score.kind === 'url') loadUrl(score.url, score.tabId ?? null)
  else if (score.kind === 'file') loadFile(score.file)
})

// Replay and Play are the same action — both start a fresh run from index 0.
// No separate state to clean up; `play()` clears sessionResult, resets stamina,
// and calls `playlist.startRun()`.
function onReplay() {
  play()
}
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.score-player {
  display: flex;
  flex-direction: column;
  gap: $gap-lg;
}
.alphatab-host {
  width: 100%;
  height: 420px;
  background: var(--bg-surface);
  color: var(--ash-brown);
  border-radius: $radius-md;
  border: 1px solid var(--panel-border);
  overflow-x: auto;
  overflow-y: auto;

  :deep(.at-surface)         { color: var(--ash-brown); }
  :deep(.at-cursor-bar)      { background: rgba(173, 193, 120, 0.32); } // muted-olive translucent
  :deep(.at-cursor-beat)     { background: var(--faded-copper); width: 3px; }
  :deep(.at-selection div)   { background: rgba(123, 143, 75, 0.18); }
  :deep(.at-highlight) *     { fill: var(--palm-leaf); stroke: var(--palm-leaf); }
}
.controls {
  display: flex;
  align-items: center;
  gap: $gap-md;
  flex-wrap: wrap;
}
.fatigue {
  display: flex;
  align-items: center;
  gap: $gap-sm;
  flex: 1;
  min-width: 240px;

  progress { flex: 1; height: 18px; }
}
.fatigue-value {
  @include tabular;
  font-size: 0.85rem;
  opacity: 0.8;
}
.load-error {
  margin: 0;
  padding: 0.6rem 0.85rem;
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  border-radius: $radius-sm;
  color: var(--ash-brown);
  font-size: 0.9rem;
}
</style>
