<template>
  <section class="score-player">
    <FileDropzone @file-loaded="onFileLoaded" />

    <div ref="playerContainer" class="alphatab-host" />

    <div v-if="isReady" class="controls">
      <button @click="playPause">{{ isPlaying ? 'Pause' : 'Play' }}</button>
      <button @click="stop">Stop</button>

      <div class="fatigue">
        <label>Stamina</label>
        <progress :value="store.fatigue" max="1" />
        <span class="fatigue-value">{{ Math.round(store.fatigue * 100) }}%</span>
      </div>
    </div>

    <SessionResult
      v-if="sessionResult"
      :result="sessionResult"
      @replay="onReplay"
    />
  </section>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAlphaTab } from '@/composables/useAlphaTab'
import { useCharacterStore } from '@/stores/character'
import { useTabSelection } from '@/composables/useTabSelection'
import FileDropzone from './FileDropzone.vue'
import SessionResult from './SessionResult.vue'

const playerContainer = ref(null)
const store = useCharacterStore()
const {
  init,
  loadFile,
  loadUrl,
  playPause,
  stop,
  clearSessionResult,
  isReady,
  isPlaying,
  sessionResult,
} = useAlphaTab(playerContainer)

const { pendingTab } = useTabSelection()

onMounted(() => init())

watch(pendingTab, (tab) => {
  if (!tab) return
  clearSessionResult()
  loadUrl(tab.file)
})

function onFileLoaded(file) {
  clearSessionResult()
  loadFile(file)
}

function onReplay() {
  clearSessionResult()
  store.resetFatigue()
  stop()
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
  height: 320px;
  background: #fff;
  color: #111;
  border-radius: 0.5rem;
  overflow-x: auto;
  overflow-y: hidden;
}
.alphatab-host :deep(.at-surface) {
  color: #111;
}
.alphatab-host :deep(.at-cursor-bar) {
  background: rgba(255, 221, 0, 0.25);
}
.alphatab-host :deep(.at-cursor-beat) {
  background: #ff4d4d;
  width: 3px;
}
.alphatab-host :deep(.at-selection div) {
  background: rgba(64, 130, 255, 0.18);
}
.alphatab-host :deep(.at-highlight) * {
  fill: #1e88ff;
  stroke: #1e88ff;
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
</style>
