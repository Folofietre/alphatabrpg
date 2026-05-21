<template>
  <section class="custom-score" :class="{ locked: isPlaying }">
    <header class="section-header">
      <h2>Custom score</h2>
      <span class="hint">{{ isPlaying ? 'Locked during play' : 'Use your own file.' }}</span>
    </header>
    <FileDropzone :disabled="isPlaying" @file-loaded="onFile" />
  </section>
</template>

<script setup>
import FileDropzone from './FileDropzone.vue'
import { useTabSelection } from '@/composables/useTabSelection'
import { usePlaybackLock } from '@/composables/usePlaybackLock'

const { selectFile } = useTabSelection()
const { isPlaying } = usePlaybackLock()

function onFile(file) {
  if (isPlaying.value) return
  selectFile(file)
}
</script>

<style scoped>
.custom-score {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.section-header h2 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  opacity: 0.85;
}
.hint {
  font-size: 0.8rem;
  opacity: 0.6;
}
</style>
