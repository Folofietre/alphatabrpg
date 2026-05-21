<template>
  <label
    class="dropzone"
    :class="{ active: isDragging, disabled }"
    @dragover.prevent="onDragOver"
    @dragenter.prevent="onDragOver"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
  >
    <input
      type="file"
      :accept="accept"
      class="file-input"
      :disabled="disabled"
      @change="onPicked"
    />
    <span v-if="!filename">
      Drop a score here, or click to browse
      <small>{{ accept }}</small>
    </span>
    <span v-else class="loaded">
      Loaded: <strong>{{ filename }}</strong>
    </span>
  </label>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['file-loaded'])

const accept = '.gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml'
const isDragging = ref(false)
const filename = ref('')

function handleFile(file) {
  if (!file || props.disabled) return
  filename.value = file.name
  emit('file-loaded', file)
}

function onDragOver() {
  if (props.disabled) return
  isDragging.value = true
}

function onDrop(e) {
  isDragging.value = false
  if (props.disabled) return
  handleFile(e.dataTransfer.files?.[0])
}

function onPicked(e) {
  handleFile(e.target.files?.[0])
}
</script>

<style scoped>
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 1.5rem;
  border: 2px dashed var(--panel-border);
  border-radius: 0.5rem;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s, background-color 0.2s, opacity 0.2s, color 0.2s;
}
.dropzone:hover:not(.disabled) {
  border-color: var(--accent-border);
  color: var(--accent);
}
.dropzone.active {
  border-color: var(--accent);
  background-color: var(--accent-bg);
  color: var(--accent);
}
.dropzone.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dropzone small {
  display: block;
  opacity: 0.6;
  font-size: 0.75rem;
}
.file-input {
  display: none;
}
.loaded strong {
  font-weight: 600;
}
</style>
