<template>
  <div class="settings-menu" :class="{ open }">
    <button
      class="gear"
      type="button"
      aria-label="Settings"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.14,12.94a7.5,7.5,0,0,0,0-1.88l2.03-1.58a.5.5,0,0,0,.12-.64l-1.92-3.32a.5.5,0,0,0-.61-.22l-2.39.96a7.43,7.43,0,0,0-1.62-.94l-.36-2.54A.5.5,0,0,0,13.9,2H10.1a.5.5,0,0,0-.5.42l-.36,2.54a7.43,7.43,0,0,0-1.62.94l-2.39-.96a.5.5,0,0,0-.61.22L2.7,8.48a.5.5,0,0,0,.12.64l2.03,1.58a7.5,7.5,0,0,0,0,1.88L2.82,14.16a.5.5,0,0,0-.12.64l1.92,3.32a.5.5,0,0,0,.61.22l2.39-.96a7.43,7.43,0,0,0,1.62.94l.36,2.54a.5.5,0,0,0,.5.42h3.8a.5.5,0,0,0,.5-.42l.36-2.54a7.43,7.43,0,0,0,1.62-.94l2.39.96a.5.5,0,0,0,.61-.22l1.92-3.32a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
        />
      </svg>
    </button>

    <div v-if="open" ref="panel" class="panel" role="dialog" aria-label="Settings">
      <h3>Settings</h3>

      <label class="row">
        <span class="row-label">
          <span>Volume</span>
          <span class="row-value">{{ Math.round(volume * 100) }}%</span>
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="volume"
          @input="onVolumeInput"
        />
      </label>

      <div class="divider" />

      <div class="danger-zone">
        <span class="zone-label">Danger zone</span>
        <button
          type="button"
          class="danger-btn"
          :disabled="isPlaying"
          @click="onResetClick"
        >
          Reset character
        </button>
        <p v-if="isPlaying" class="zone-hint">Stop the current session first.</p>
        <p v-else class="zone-hint">Wipes character, stats and history.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { usePlaybackLock } from '@/composables/usePlaybackLock'
import { useCharacterStore } from '@/stores/character'

const { volume, setVolume } = useSettings()
const { isPlaying } = usePlaybackLock()
const store = useCharacterStore()

const open = ref(false)
const panel = ref(null)

function toggle() {
  open.value = !open.value
}

function onVolumeInput(e) {
  setVolume(parseFloat(e.target.value))
}

function onResetClick() {
  if (isPlaying.value) return
  const ok = window.confirm(
    'Reset character?\n\nAll progress (stats, history, completed sessions) will be lost. This cannot be undone.',
  )
  if (!ok) return
  store.reset()
  open.value = false
}

function onDocClick(e) {
  if (!open.value) return
  if (!e.target.closest('.settings-menu')) open.value = false
}

function onKey(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.settings-menu {
  position: relative;
}
.gear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid var(--panel-border);
  border-radius: 50%;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  transition: transform 0.4s ease, background-color 0.2s, border-color 0.2s, color 0.2s;
}
.gear:hover {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}
.settings-menu.open .gear {
  transform: rotate(60deg);
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}
.panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  min-width: 240px;
  padding: 0.75rem 1rem 1rem;
  background: var(--bg-elevated);
  border: 1px solid var(--panel-border);
  border-radius: 0.5rem;
  box-shadow: var(--shadow);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.panel h3 {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.9;
}
.row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
}
.row-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  opacity: 0.9;
}
.row-value {
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--palm-leaf);
}
.divider {
  height: 1px;
  background: var(--panel-border);
  margin: 0.25rem 0;
}
.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.zone-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
  color: var(--faded-copper);
}
.zone-hint {
  margin: 0;
  font-size: 0.78rem;
  opacity: 0.75;
  line-height: 1.35;
}
.zone-hint.warn {
  color: var(--faded-copper);
  opacity: 1;
}
.danger-btn {
  align-self: flex-start;
  padding: 0.4rem 0.85rem;
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  color: var(--faded-copper);
  border-radius: 0.4rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.danger-btn:hover:not(:disabled) {
  background: var(--faded-copper);
  border-color: var(--faded-copper);
  color: var(--vanilla-cream);
}
.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
