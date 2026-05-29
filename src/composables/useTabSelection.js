import { ref } from 'vue'

const pendingScore = ref(null)

export function useTabSelection() {
  function selectTab(tab) {
    pendingScore.value = {
      kind: 'url',
      url: tab.file,
      tabId: tab.id,
      label: tab.title,
      requestedAt: Date.now(),
    }
  }
  // TODO: re-enable once Custom Score is unlocked as an end-game reward.
  // Currently no UI calls this — the CustomScore.vue component is unmounted
  // (see App.vue). The plumbing stays so re-introducing the feature is just a
  // mount + a gate on completion of every built-in score.
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
