import { ref } from 'vue'

// Singleton manifest cache. Both TabLibrary and CustomScore consume it.
const manifest = ref({ categories: [], tabs: [] })
const loading = ref(false)
const loaded = ref(false)
const error = ref(false)

async function ensureLoaded() {
  if (loaded.value || loading.value) return
  loading.value = true
  try {
    const res = await fetch('/tabs/index.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    manifest.value = await res.json()
    loaded.value = true
  } catch (e) {
    error.value = true
    console.error('[useTabsManifest] failed:', e)
  } finally {
    loading.value = false
  }
}

export function useTabsManifest() {
  ensureLoaded()
  return { manifest, loading, loaded, error }
}
