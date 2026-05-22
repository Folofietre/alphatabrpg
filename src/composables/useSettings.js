import { ref, watch } from 'vue'

const VOLUME_KEY = 'alphatab_rpg_volume'
const BACKING_VOLUME_KEY = 'alphatab_rpg_backing_volume'

function loadFloat(key, fallback) {
  const raw = localStorage.getItem(key)
  const parsed = raw == null ? NaN : parseFloat(raw)
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback
}

const volume = ref(loadFloat(VOLUME_KEY, 0.8))
const backingVolume = ref(loadFloat(BACKING_VOLUME_KEY, 1))

watch(volume, (v) => {
  localStorage.setItem(VOLUME_KEY, String(v))
})
watch(backingVolume, (v) => {
  localStorage.setItem(BACKING_VOLUME_KEY, String(v))
})

export function useSettings() {
  function setVolume(value) {
    volume.value = Math.min(1, Math.max(0, value))
  }
  function setBackingVolume(value) {
    backingVolume.value = Math.min(1, Math.max(0, value))
  }
  return { volume, setVolume, backingVolume, setBackingVolume }
}
