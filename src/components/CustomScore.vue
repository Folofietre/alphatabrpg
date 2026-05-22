<template>
  <section class="custom-score" :class="{ locked: !unlocked, playing: isPlaying }">
    <header class="section-header">
      <h2>Custom score</h2>
      <span class="hint">{{ headerHint }}</span>
    </header>

    <p v-if="!unlocked" class="lock-hint">
      🔒 Complete every built-in score to unlock custom uploads.
      <span class="progress">({{ completedBuiltinCount }}/{{ totalBuiltinCount }})</span>
    </p>

    <FileDropzone v-else :disabled="isPlaying" @file-loaded="onFile" />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import FileDropzone from './FileDropzone.vue'
import { useTabSelection } from '@/composables/useTabSelection'
import { usePlaybackLock } from '@/composables/usePlaybackLock'
import { useTabsManifest } from '@/composables/useTabsManifest'
import { useCharacterStore } from '@/stores/character'

const { selectFile } = useTabSelection()
const { isPlaying } = usePlaybackLock()
const { manifest } = useTabsManifest()
const store = useCharacterStore()

const totalBuiltinCount = computed(() => manifest.value.tabs.length)
const completedBuiltinCount = computed(() =>
  manifest.value.tabs.filter((t) => !!store.completedTabs[t.id]).length,
)
const unlocked = computed(
  () => totalBuiltinCount.value > 0 && completedBuiltinCount.value >= totalBuiltinCount.value,
)

const headerHint = computed(() => {
  if (!unlocked.value) return 'Locked'
  if (isPlaying.value) return 'Locked during play'
  return 'Use your own file.'
})

function onFile(file) {
  if (!unlocked.value) return
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
.lock-hint {
  margin: 0;
  padding: 0.65rem 0.8rem;
  font-size: 0.85rem;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 0.5rem;
  font-style: italic;
  line-height: 1.4;
}
.lock-hint .progress {
  display: inline-block;
  margin-left: 0.35rem;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  opacity: 0.85;
}
.custom-score.locked .section-header {
  opacity: 0.7;
}
</style>
