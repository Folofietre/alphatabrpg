import { ref } from 'vue'

const pendingTab = ref(null)

export function useTabSelection() {
  function selectTab(tab) {
    pendingTab.value = { ...tab, requestedAt: Date.now() }
  }
  return { pendingTab, selectTab }
}
