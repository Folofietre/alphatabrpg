<template>
  <label
    class="dropzone"
    :class="{ active: isDragging }"
    @dragover.prevent="isDragging = true"
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
  >
    <input
      type="file"
      :accept="accept"
      class="file-input"
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

const emit = defineEmits(['file-loaded'])

const accept = '.gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml'
const isDragging = ref(false)
const filename = ref('')

function handleFile(file) {
  if (!file) return
  filename.value = file.name
  emit('file-loaded', file)
}

function onDrop(e) {
  isDragging.value = false
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
  border: 2px dashed var(--color-border, #888);
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s, background-color 0.2s;
}
.dropzone.active {
  border-color: #5fa8ff;
  background-color: rgba(95, 168, 255, 0.08);
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
