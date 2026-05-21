<template>
  <aside class="library">
    <header class="library-header">
      <h2>Built-in scores</h2>
      <span class="hint">Pick one, or drop your own.</span>
    </header>

    <ul class="list">
      <li v-for="tab in tabs" :key="tab.id">
        <button
          type="button"
          class="card"
          :class="{ active: selectedId === tab.id }"
          @click="onPick(tab)"
        >
          <span class="title">{{ tab.title }}</span>
          <span class="artist">{{ tab.artist }}</span>
          <span class="difficulty" :data-level="tab.difficulty.toLowerCase()">
            {{ tab.difficulty }}
          </span>
        </button>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { ref } from 'vue'
import { builtinTabs } from '@/data/builtinTabs'
import { useTabSelection } from '@/composables/useTabSelection'

const { selectTab } = useTabSelection()

const tabs = builtinTabs
const selectedId = ref(null)

function onPick(tab) {
  selectedId.value = tab.id
  selectTab(tab)
}
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
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, transform 0.1s;
}
.card:hover {
  border-color: rgba(95, 168, 255, 0.6);
  background: rgba(95, 168, 255, 0.08);
}
.card:active {
  transform: scale(0.98);
}
.card.active {
  border-color: #5fa8ff;
  background: rgba(95, 168, 255, 0.14);
}
.title {
  font-weight: 600;
  font-size: 0.95rem;
}
.artist {
  font-size: 0.8rem;
  opacity: 0.7;
}
.difficulty {
  margin-top: 0.25rem;
  align-self: flex-start;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.08);
}
.difficulty[data-level='beginner'] {
  background: rgba(80, 200, 120, 0.18);
  color: #82e3a4;
}
.difficulty[data-level='intermediate'] {
  background: rgba(255, 200, 80, 0.18);
  color: #ffd07a;
}
.difficulty[data-level='advanced'] {
  background: rgba(255, 100, 100, 0.18);
  color: #ff9090;
}
</style>
