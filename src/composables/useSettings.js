import { ref, watch } from 'vue'

const VOLUME_KEY = 'alphatab_rpg_volume'

function loadVolume() {
  const raw = localStorage.getItem(VOLUME_KEY)
  const parsed = raw == null ? NaN : parseFloat(raw)
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.8
}

const volume = ref(loadVolume())

watch(volume, (v) => {
  localStorage.setItem(VOLUME_KEY, String(v))
})

export function useSettings() {
  function setVolume(value) {
    volume.value = Math.min(1, Math.max(0, value))
  }
  return { volume, setVolume }
}
