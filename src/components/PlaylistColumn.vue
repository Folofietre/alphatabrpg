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
        <div class="row-head">
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
        </div>
        <div class="speed-row" :title="speedTooltip(idx)">
          <span class="slider-wrap">
            <input
              type="range"
              class="speed"
              :min="SPEED_MIN_PCT"
              :max="SPEED_MAX_PCT"
              step="1"
              :value="speedPct(idx)"
              :disabled="isRunning"
              @input="onSpeedInput(idx, $event)"
            />
            <span
              v-if="comfortPct(idx) != null"
              class="comfort-notch"
              :style="markerStyle(idx)"
              aria-hidden="true"
            />
          </span>
          <span class="speed-value">{{ speedLabel(idx) }}</span>
        </div>
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
import { usePlaylist, SPEED_MIN, SPEED_MAX, comfortFor } from '@/composables/usePlaylist'
import { usePlaybackLock } from '@/composables/usePlaybackLock'
import { usePlayerActions } from '@/composables/usePlayerActions'
import { useCharacterStore } from '@/stores/character'

const playlist = usePlaylist()
const { isPlaying } = usePlaybackLock()
const playerActions = usePlayerActions()
const store = useCharacterStore()

const SPEED_MIN_PCT = Math.round(SPEED_MIN * 100)
const SPEED_MAX_PCT = Math.round(SPEED_MAX * 100)

const queue = computed(() => playlist.queue.value)
const length = computed(() => playlist.length.value)
const currentIndex = computed(() => playlist.currentIndex.value)
const consecutive = computed(() => playlist.consecutive.value)
const bonusMultiplier = computed(() => playlist.bonusMultiplier.value)
const isRunning = computed(() => playlist.isRunning.value)

function isPlayedAt(idx) {
  return playlist.isPlayedAt(idx)
}

function speedFor(idx) {
  return queue.value[idx]?.selectedSpeed ?? null
}
function speedPct(idx) {
  const v = speedFor(idx)
  return v == null ? SPEED_MAX_PCT : Math.round(v * 100)
}
function speedLabel(idx) {
  const v = speedFor(idx)
  return v == null ? '—' : `${Math.round(v * 100)}%`
}
function comfortPct(idx) {
  const tab = queue.value[idx]
  const record = tab?.id ? store.tabRecords?.[tab.id] : null
  const c = comfortFor(store.character.speed, record?.onsetRate)
  if (c == null) return null
  return Math.round(c * 100)
}
function markerStyle(idx) {
  const pct = comfortPct(idx)
  if (pct == null) return null
  // Map the comfort % onto the slider's [SPEED_MIN_PCT, SPEED_MAX_PCT] range
  // as a unitless 0..1 ratio (used by the .comfort-notch positioning calc).
  const clamped = Math.max(SPEED_MIN_PCT, Math.min(SPEED_MAX_PCT, pct))
  const ratio = (clamped - SPEED_MIN_PCT) / (SPEED_MAX_PCT - SPEED_MIN_PCT)
  return { '--marker-pos': ratio.toFixed(4) }
}
function speedTooltip(idx) {
  const c = comfortPct(idx)
  if (c == null) return 'Pick this song\'s playback speed.'
  return `Your comfort: ${c}%. Pick higher to push for a bigger score.`
}
function onSpeedInput(idx, event) {
  const v = Number(event.target.value) / 100
  playlist.setSelectedSpeedAt(idx, v)
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
  flex-direction: column;
  gap: 0.35rem;
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
.row-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.speed-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 1.75rem; // align with the title (past the marker)
}
.slider-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}
.speed {
  width: 100%;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
  position: relative;
  z-index: 1;

  &:disabled { cursor: not-allowed; opacity: 0.6; }
}
.comfort-notch {
  position: absolute;
  // The thumb has finite width and slides between (thumb/2) and (100% - thumb/2).
  // Approximating that inset with a 6px margin keeps the notch visually aligned
  // with the slider value across browsers.
  left: calc(6px + (100% - 12px) * var(--marker-pos, 0));
  top: 50%;
  width: 2px;
  height: 14px;
  margin-left: -1px;
  margin-top: -7px;
  background: var(--text-muted);
  opacity: 0.65;
  pointer-events: none;
  z-index: 0;
  border-radius: 1px;
}
.speed-value {
  @include tabular;
  font-size: 0.75rem;
  opacity: 0.8;
  min-width: 2.5rem;
  text-align: right;
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
