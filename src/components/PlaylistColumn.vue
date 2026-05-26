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

    <div v-if="length > 0" class="transport">
      <button
        type="button"
        class="play"
        :disabled="isPlaying"
        :title="isPlaying ? 'Already playing' : 'Start playing'"
        @click="onPlay"
      >▶ Play</button>
      <button
        type="button"
        class="stop"
        :disabled="!isPlaying"
        :title="isPlaying ? 'Stop and end the session' : 'Nothing to stop'"
        @click="onStop"
      >■ Stop</button>
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
import { usePlaybackLock } from '@/composables/usePlaybackLock'
import { usePlayerActions } from '@/composables/usePlayerActions'

const playlist = usePlaylist()
const { isPlaying } = usePlaybackLock()
const playerActions = usePlayerActions()

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

function onPlay() {
  playerActions.play()
}
function onStop() {
  playerActions.stop()
}
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

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

  h2 {
    @include section-label;
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.02em;
    opacity: 0.85;
  }
}
.count {
  @include tabular;
  font-size: 0.75rem;
  opacity: 0.7;
}
.empty {
  @include hint-text;
  margin: 0;
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
  @include panel-card;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  transition:
    border-color $transition-fast,
    background-color $transition-fast,
    opacity $transition-fast;

  &.current {
    border-color: var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
  }
  &.played {
    opacity: 0.55;

    .marker { color: var(--palm-leaf); }
  }
}
.marker {
  @include tabular;
  width: 1.25rem;
  text-align: center;
  font-size: 0.85rem;
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
  transition:
    background-color $transition-fast,
    color $transition-fast,
    border-color $transition-fast;

  &:hover {
    background: var(--warn-bg);
    border-color: var(--warn-border);
    color: var(--faded-copper);
  }
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
.transport {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;

  button {
    flex: 1;
    padding: 0.5rem 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
  }
  .play  { @include button-accent; }
  .stop  { @include button-danger; }
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
