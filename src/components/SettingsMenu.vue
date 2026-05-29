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

      <label class="row">
        <span class="row-label">
          <span>Backing volume</span>
          <span class="row-value">{{ Math.round(backingVolume * 100) }}%</span>
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="backingVolume"
          @input="onBackingInput"
        />
        <small class="row-help">Other instruments in the score.</small>
      </label>

      <div class="divider" />

      <div class="save-zone">
        <span class="zone-label">Save data</span>
        <div class="save-buttons">
          <button type="button" class="save-btn" @click="onExportClick">
            Export
          </button>
          <button
            type="button"
            class="save-btn"
            :disabled="isPlaying"
            @click="onImportClick"
          >
            Import…
          </button>
        </div>
        <input
          ref="importInput"
          type="file"
          accept="application/json,.json"
          class="hidden-input"
          @change="onImportFile"
        />
        <p v-if="importMessage" class="zone-hint" :class="{ warn: !importOk }">
          {{ importMessage }}
        </p>
        <p v-else class="zone-hint">Download a JSON backup or restore one.</p>
      </div>

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

const { volume, setVolume, backingVolume, setBackingVolume } = useSettings()
const { isPlaying } = usePlaybackLock()
const store = useCharacterStore()

const open = ref(false)
const panel = ref(null)
const importInput = ref(null)
const importMessage = ref('')
const importOk = ref(true)

function triggerDownload(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function onExportClick() {
  const payload = store.exportSaveData()
  const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const name = (store.character.name || 'musician').replace(/\W+/g, '-').toLowerCase()
  triggerDownload(`alphatab-rpg-${name}-${stamp}.json`, JSON.stringify(payload, null, 2))
  importMessage.value = 'Save exported.'
  importOk.value = true
}

function onImportClick() {
  if (isPlaying.value) return
  importMessage.value = ''
  importInput.value?.click()
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  // Reset the input so re-picking the same file fires `change` again.
  e.target.value = ''
  if (!file) return
  const ok = window.confirm(
    `Import "${file.name}"?\n\nThis will REPLACE your current save — exported it first if you want a backup.`,
  )
  if (!ok) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const result = store.importSaveData(parsed)
    if (!result.ok) {
      importMessage.value = `Import failed: ${result.reason}`
      importOk.value = false
      return
    }
    importMessage.value = 'Save imported.'
    importOk.value = true
  } catch (err) {
    importMessage.value = `Import failed: ${err?.message ?? 'invalid file'}`
    importOk.value = false
  }
}

function toggle() {
  open.value = !open.value
}

function onVolumeInput(e) {
  setVolume(parseFloat(e.target.value))
}

function onBackingInput(e) {
  setBackingVolume(parseFloat(e.target.value))
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

<style scoped lang="scss">
@use '@/styles/mixins' as *;

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

  &:hover {
    background: var(--accent-bg);
    border-color: var(--accent-border);
    color: var(--accent);
  }
}
.settings-menu.open .gear {
  transform: rotate(60deg);
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}
.panel {
  @include panel-card;
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  min-width: 240px;
  padding: 0.75rem 1rem 1rem;
  background: var(--bg-elevated);
  box-shadow: var(--shadow);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  h3 {
    margin: 0;
    font-size: 0.95rem;
    opacity: 0.9;
  }
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
  @include tabular;
  opacity: 0.7;
}
.row-help {
  font-size: 0.72rem;
  opacity: 0.6;
  margin-top: 0.1rem;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--palm-leaf);
}
.divider {
  @include divider;
}
.save-zone,
.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.save-buttons {
  display: flex;
  gap: 0.4rem;
}
.save-btn {
  @include button-accent;
  flex: 1;
  font-size: 0.82rem;
  padding: 0.3rem 0.6rem;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
.hidden-input {
  display: none;
}
.zone-label {
  @include section-label;
  color: var(--faded-copper);
}
.zone-hint {
  margin: 0;
  font-size: 0.78rem;
  opacity: 0.75;
  line-height: 1.35;

  &.warn {
    color: var(--faded-copper);
    opacity: 1;
  }
}
.danger-btn {
  @include button-danger;
  align-self: flex-start;
  font-size: 0.85rem;
}
</style>
