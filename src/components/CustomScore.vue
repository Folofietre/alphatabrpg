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
import { useTabDifficulty } from '@/composables/useTabDifficulty'
import { useCharacterStore } from '@/stores/character'

const { selectFile } = useTabSelection()
const { isPlaying } = usePlaybackLock()
const { manifest } = useTabsManifest()
const difficulty = useTabDifficulty()
const store = useCharacterStore()

// Only built-in tabs the current character can actually play count toward the
// unlock — otherwise a piano player would be locked out forever by a bass-only
// tab they can't see.
const playableTabs = computed(() =>
  manifest.value.tabs.filter((t) => difficulty.isPlayable(t.id) === true),
)
const totalBuiltinCount = computed(() => playableTabs.value.length)
const completedBuiltinCount = computed(() =>
  playableTabs.value.filter((t) => (store.tabRecords[t.id]?.completionsCount ?? 0) > 0).length,
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

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.custom-score {
  display: flex;
  flex-direction: column;
  gap: $gap-sm;

  &.locked .section-header { opacity: 0.7; }
}
.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $gap-sm;
  flex-wrap: wrap;

  h2 {
    @include section-label;
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.02em;
    opacity: 0.85;
  }
}
.hint {
  font-size: 0.8rem;
  opacity: 0.6;
}
.lock-hint {
  @include panel-card;
  margin: 0;
  padding: 0.65rem 0.8rem;
  font-size: 0.85rem;
  font-style: italic;
  line-height: 1.4;

  .progress {
    @include tabular;
    display: inline-block;
    margin-left: 0.35rem;
    font-style: normal;
    font-weight: 600;
    opacity: 0.85;
  }
}
</style>
