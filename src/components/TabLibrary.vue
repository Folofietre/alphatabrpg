<template>
  <aside class="library" :class="{ locked: isPlaying }">
    <header class="library-header">
      <h2>Built-in scores</h2>
      <span class="hint">{{ headerHint }}</span>
    </header>

    <p v-if="error" class="error">Could not load the score list.</p>

    <ul v-else class="list">
      <li v-for="tab in tabs" :key="tab.id">
        <button
          type="button"
          class="card"
          :class="{ active: selectedId === tab.id }"
          :disabled="isPlaying"
          :title="isPlaying ? 'Stop the current session first' : ''"
          @click="onPick(tab)"
        >
          <span class="title">{{ tab.title }}</span>
          <span class="artist">{{ tab.artist }}</span>
        </button>
      </li>
      <li v-if="!loading && tabs.length === 0" class="empty">
        Drop tab files into <code>public/tabs/</code>.
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useTabSelection } from '@/composables/useTabSelection'
import { usePlaybackLock } from '@/composables/usePlaybackLock'

const { selectTab, pendingScore } = useTabSelection()
const { isPlaying } = usePlaybackLock()

const tabs = ref([])
const selectedId = ref(null)
const loading = ref(true)
const error = ref(false)

const headerHint = computed(() => {
  if (loading.value) return 'Loading…'
  if (isPlaying.value) return 'Locked during play'
  if (tabs.value.length === 0) return ''
  return 'Pick one, or drop your own.'
})

watch(pendingScore, (s) => {
  if (s?.kind !== 'url') selectedId.value = null
})

function onPick(tab) {
  selectedId.value = tab.id
  selectTab(tab)
}

onMounted(async () => {
  try {
    const res = await fetch('/tabs/index.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    tabs.value = await res.json()
  } catch (e) {
    error.value = true
    console.error('Failed to load tab manifest:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.library-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.library-header h2 {
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
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.65rem 0.8rem;
  text-align: left;
  border: 1px solid var(--panel-border);
  border-radius: 0.5rem;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, transform 0.1s, color 0.15s;
  width: 100%;
}
.card:hover:not(:disabled) {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
}
.card:active:not(:disabled) {
  transform: scale(0.98);
}
.card.active {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
}
.card:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.title {
  font-weight: 600;
  font-size: 0.95rem;
}
.artist {
  font-size: 0.8rem;
  opacity: 0.7;
}
.empty {
  font-size: 0.85rem;
  opacity: 0.7;
  padding: 0.5rem;
}
.empty code {
  background: var(--panel-strong);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: var(--mono);
}
.error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--loss);
}
</style>
