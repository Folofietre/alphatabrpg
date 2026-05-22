<template>
  <aside class="playlist-col">
    <header class="col-header">
      <h2>Playlist</h2>
      <span v-if="length > 0" class="count">{{ length }} song{{ length > 1 ? 's' : '' }}</span>
    </header>

    <p v-if="length === 0" class="empty">
      Click scores on the right to build a playlist.
    </p>

    <ul v-else class="queue">
      <li
        v-for="(tab, idx) in queue"
        :key="`${idx}-${tab.id}`"
        class="row"
        :class="{
          current: idx === currentIndex,
          played: isPlayedAt(idx) && idx !== currentIndex,
          upcoming: idx > currentIndex,
        }"
      >
        <span class="marker" aria-hidden="true">
          {{ idx === currentIndex ? '▶' : isPlayedAt(idx) ? '✓' : idx + 1 }}
        </span>
        <div class="meta">
          <span class="title">{{ tab.title }}</span>
          <span class="artist">{{ tab.artist }}</span>
        </div>
        <button
          v-if="canRemove(idx)"
          type="button"
          class="remove"
          :title="`Remove ${tab.title}`"
          @click="removeAt(idx)"
        >×</button>
      </li>
    </ul>

    <div v-if="length > 0 && consecutive > 0" class="bonus">
      Streak ×{{ consecutive }} — next gain bonus: ×{{ bonusMultiplier.toFixed(2) }}
    </div>

    <div v-if="length > 0" class="actions">
      <button
        type="button"
        class="clear"
        :disabled="isRunning"
        :title="isRunning ? 'Stop the run first' : 'Empty the playlist'"
        @click="clear"
      >Clear</button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { usePlaylist } from '@/composables/usePlaylist'

const playlist = usePlaylist()

const queue = computed(() => playlist.queue.value)
const length = computed(() => playlist.length.value)
const currentIndex = computed(() => playlist.currentIndex.value)
const consecutive = computed(() => playlist.consecutive.value)
const bonusMultiplier = computed(() => playlist.bonusMultiplier.value)
const isRunning = computed(() => playlist.isRunning.value)

function isPlayedAt(idx) {
  return playlist.isPlayedAt(idx)
}

function canRemove(idx) {
  // Can't remove the currently-loaded track while a run is in progress.
  if (idx === currentIndex.value && isRunning.value) return false
  return true
}

function removeAt(idx) {
  playlist.removeAt(idx)
}

function clear() {
  playlist.clear()
}
</script>

<style scoped>
.playlist-col {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.col-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.col-header h2 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  opacity: 0.85;
}
.count {
  font-size: 0.75rem;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.empty {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.7;
  font-style: italic;
  padding: 0.5rem;
}
.queue {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--panel-border);
  border-radius: 0.4rem;
  background: var(--panel);
  transition: border-color 0.15s, background-color 0.15s, opacity 0.15s;
}
.row.current {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
}
.row.played {
  opacity: 0.55;
}
.row.played .marker {
  color: var(--palm-leaf);
}
.marker {
  width: 1.25rem;
  text-align: center;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
  flex-shrink: 0;
}
.meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}
.title {
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist {
  font-size: 0.74rem;
  opacity: 0.7;
}
.remove {
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 1rem;
  line-height: 1;
  border-radius: 50%;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.remove:hover {
  background: var(--warn-bg);
  border-color: var(--warn-border);
  color: var(--faded-copper);
}
.bonus {
  font-size: 0.75rem;
  padding: 0.35rem 0.6rem;
  border-radius: 0.3rem;
  background: var(--accent-bg);
  color: var(--accent);
  text-align: center;
  font-weight: 500;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
.clear {
  font-size: 0.8rem;
  padding: 0.3rem 0.7rem;
}
</style>
