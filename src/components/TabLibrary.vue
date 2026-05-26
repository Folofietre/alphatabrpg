<template>
  <aside class="library" :class="{ locked: isPlaying }">
    <header class="library-header">
      <h2>Score library</h2>
      <span class="hint">{{ headerHint }}</span>
    </header>

    <p v-if="error" class="error">Could not load the score list.</p>

    <div v-else class="categories">
      <section
        v-for="cat in visibleCategories"
        :key="cat.id"
        class="category"
        :class="{ locked: !cat.unlocked }"
      >
        <header class="category-header" @click="toggleOpen(cat.id)">
          <span class="caret">{{ openIds.has(cat.id) ? '▼' : '▶' }}</span>
          <span class="cat-title">{{ cat.label }}</span>
          <span v-if="cat.unlocked" class="cat-progress">
            {{ cat.completedCount }}/{{ cat.tabs.length }} ✓
          </span>
          <span v-else class="cat-lock">🔒</span>
        </header>

        <p v-if="!cat.unlocked && cat.hint" class="cat-hint">{{ cat.hint }}</p>

        <ul v-if="cat.unlocked && openIds.has(cat.id)" class="list">
          <li v-for="tab in cat.tabs" :key="tab.id">
            <button
              type="button"
              class="card"
              :class="{ completed: tab.completed, queued: queuedIds.has(tab.id) }"
              :disabled="isPlaying"
              :title="cardTitle(tab)"
              @click="onPick(tab)"
            >
              <span class="check" aria-hidden="true">{{ tab.completed ? '✓' : '☐' }}</span>
              <div class="row-mid">
                <div class="row-top">
                  <span class="title">{{ tab.title }}</span>
                  <DifficultyStars :info="difficulty.get(tab.id)" />
                </div>
                <span class="artist">{{ tab.artist }}</span>
                <div v-if="tab.record" class="row-record">
                  <span class="score" :title="`Best: ${pct(tab.record.bestAccuracy)} accuracy at ${pct(tab.record.bestPlaybackSpeed)} tempo`">
                    {{ scoreStars(tab.record.bestStars) }} {{ Math.round(tab.record.bestScore) }}%
                  </span>
                  <ComfortBar :familiarity="tab.record.familiarity" />
                </div>
                <div v-else-if="tab.familiarity > 0" class="row-record">
                  <ComfortBar :familiarity="tab.familiarity" />
                </div>
              </div>
            </button>
          </li>
        </ul>
      </section>

      <p v-if="!loading && visibleCategories.length === 0" class="empty">
        No scores available for your instrument.
      </p>
    </div>
  </aside>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { usePlaybackLock } from '@/composables/usePlaybackLock'
import { usePlaylist } from '@/composables/usePlaylist'
import { useTabDifficulty } from '@/composables/useTabDifficulty'
import { useTabsManifest } from '@/composables/useTabsManifest'
import { evaluateUnlock, buildUnlockContext } from '@/utils/categoryUnlocks'
import DifficultyStars from './DifficultyStars.vue'
import ComfortBar from './ComfortBar.vue'

const store = useCharacterStore()
const { isPlaying } = usePlaybackLock()
const playlist = usePlaylist()
const difficulty = useTabDifficulty()
const { manifest, loading, error } = useTabsManifest()

const openIds = reactive(new Set())

const headerHint = computed(() => {
  if (loading.value) return 'Loading…'
  if (isPlaying.value) return 'Locked during play'
  return 'Click to queue.'
})

// Filter manifest tabs to those playable for the character's instrument,
// then group by category and evaluate each unlock rule.
// `difficulty.isPlayable(id)` returns:
//   - true   → playable (keep)
//   - false  → not playable (hide)
//   - null   → still parsing (keep optimistically; it'll filter itself once known)
const visibleCategories = computed(() => {
  const allTabs = manifest.value.tabs
  const playableTabs = allTabs.filter((t) => difficulty.isPlayable(t.id) !== false)

  // Unlock context restricted to the playable subset so `all_completed` only
  // counts what this character can actually play.
  const ctx = buildUnlockContext({
    tabs: playableTabs,
    tabRecords: store.tabRecords,
    character: store.character,
  })

  const categories = manifest.value.categories.map((cat) => {
    const tabsInCat = playableTabs
      .filter((t) => t.category === cat.id)
      .map((t) => {
        const rec = store.tabRecords[t.id]
        const completed = (rec?.completionsCount ?? 0) > 0
        return {
          ...t,
          completed,
          // Full record (best score, etc.) only when there's been a completion.
          record: completed ? rec : null,
          // Surface familiarity even before first completion so the comfort
          // bar can hint at growth from failed attempts.
          familiarity: rec?.familiarity ?? 0,
        }
      })
    const completedCount = tabsInCat.filter((t) => t.completed).length
    const unlocked = evaluateUnlock(cat.unlock, ctx)
    return { ...cat, tabs: tabsInCat, completedCount, unlocked }
  })

  // Hide locked categories that have no hint, and hide unlocked categories
  // that ended up with zero playable tabs for this instrument.
  return categories.filter((cat) => {
    if (!cat.unlocked && !cat.hint) return false
    if (cat.unlocked && cat.tabs.length === 0) return false
    return true
  })
})

const queuedIds = computed(() => new Set(playlist.queue.value.map((t) => t.id)))

function toggleOpen(id) {
  if (openIds.has(id)) openIds.delete(id)
  else openIds.add(id)
}

function cardTitle(tab) {
  if (isPlaying.value) return 'Stop the current session first'
  if (queuedIds.value.has(tab.id)) return 'Click again to queue another time'
  return 'Add to playlist'
}

function onPick(tab) {
  playlist.append(tab)
}

function scoreStars(n) {
  const filled = Math.max(0, Math.min(5, n ?? 0))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}
function pct(v) {
  if (v == null) return '—'
  return `${Math.round(v * 100)}%`
}

// Once the manifest is loaded (singleton, may have been fetched by another
// component), open the first unlocked category and kick off difficulty
// analysis for every tab.
watch(
  () => manifest.value.tabs.length,
  (count) => {
    if (count === 0) return
    const firstUnlocked = visibleCategories.value.find((c) => c.unlocked)
    if (firstUnlocked && openIds.size === 0) openIds.add(firstUnlocked.id)
    for (const tab of manifest.value.tabs) {
      difficulty.ensure(tab, store.character.instrument)
    }
  },
  { immediate: true },
)
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
.categories {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.category {
  border: 1px solid var(--panel-border);
  border-radius: 0.5rem;
  background: var(--panel);
  overflow: hidden;
}
.category.locked {
  opacity: 0.7;
}
.category-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  cursor: pointer;
  user-select: none;
}
.category.locked .category-header {
  cursor: default;
}
.caret {
  width: 0.9rem;
  font-size: 0.75rem;
  opacity: 0.7;
}
.category.locked .caret {
  visibility: hidden;
}
.cat-title {
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
}
.cat-progress {
  font-size: 0.75rem;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.cat-lock {
  font-size: 0.9rem;
}
.cat-hint {
  margin: 0 0.7rem 0.5rem 1.9rem;
  font-size: 0.78rem;
  opacity: 0.75;
  font-style: italic;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0.3rem 0.4rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.card {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.5rem 0.7rem;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 0.4rem;
  background: var(--bg-elevated);
  color: var(--text);
  cursor: pointer;
  width: 100%;
  font: inherit;
  transition: border-color 0.15s, background-color 0.15s, color 0.15s, transform 0.1s;
}
.card:hover:not(:disabled) {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
}
.card:active:not(:disabled) {
  transform: scale(0.98);
}
.card.queued {
  border-color: var(--accent);
  background: var(--accent-bg);
}
.card.completed .check {
  color: var(--palm-leaf);
}
.card:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.check {
  flex-shrink: 0;
  font-size: 0.95rem;
  line-height: 1.3;
  width: 1rem;
  text-align: center;
  color: var(--text-muted);
}
.row-mid {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.row-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
}
.title {
  font-weight: 600;
  font-size: 0.9rem;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist {
  font-size: 0.78rem;
  opacity: 0.7;
}
.row-record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.2rem;
}
.score {
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: var(--palm-leaf);
}
.empty {
  font-size: 0.85rem;
  opacity: 0.7;
  padding: 0.5rem;
  text-align: center;
}
.error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--loss);
}
</style>
