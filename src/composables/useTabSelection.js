import { ref } from 'vue'

const pendingScore = ref(null)

export function useTabSelection() {
  function selectTab(tab) {
    pendingScore.value = {
      kind: 'url',
      url: tab.file,
      label: tab.title,
      requestedAt: Date.now(),
    }
  }
  function selectFile(file) {
    pendingScore.value = {
      kind: 'file',
      file,
      label: file.name,
      requestedAt: Date.now(),
    }
  }
  return { pendingScore, selectTab, selectFile }
}
