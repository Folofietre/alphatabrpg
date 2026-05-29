import { computed } from 'vue'
import { useTabsManifest } from '@/composables/useTabsManifest'
import { useCharacterStore } from '@/stores/character'
import { useTabDifficulty } from '@/composables/useTabDifficulty'

// Single source of truth for category-reward logic.
// - `categoriesWithRewards` exposes every category that has a reward, with
//   completion progress and claimed status for the Rewards tab UI.
// - `checkClaimForTab(tabId)` is called by useAlphaTab after a song completes
//   to detect "this completion just finished the category" and claim the
//   reward atomically. Returns the applied reward array (or []).
export function useRewards() {
  const { manifest } = useTabsManifest()
  const store = useCharacterStore()
  const difficulty = useTabDifficulty()

  // Tabs in a category that the player's instrument can actually play.
  function playableTabsIn(categoryId) {
    return (manifest.value?.tabs ?? []).filter(
      (t) => t.category === categoryId && difficulty.isPlayable(t.id) !== false,
    )
  }

  function isCategoryComplete(categoryId) {
    const tabs = playableTabsIn(categoryId)
    if (tabs.length === 0) return false
    return tabs.every((t) => (store.tabRecords?.[t.id]?.completionsCount ?? 0) > 0)
  }

  function progressFor(categoryId) {
    const tabs = playableTabsIn(categoryId)
    const done = tabs.filter((t) => (store.tabRecords?.[t.id]?.completionsCount ?? 0) > 0).length
    return { done, total: tabs.length }
  }

  // Format a single reward entry as a short display string.
  function describeReward(r) {
    if (!r) return ''
    const sign = r.value >= 0 ? '+' : ''
    const stat = r.stat.charAt(0).toUpperCase() + r.stat.slice(1)
    const unit = r.mode === 'percent' ? '%' : ''
    return `${sign}${r.value}${unit} ${stat}`
  }

  const categoriesWithRewards = computed(() => {
    const cats = manifest.value?.categories ?? []
    return cats
      .filter((c) => Array.isArray(c.reward) && c.reward.length > 0)
      .map((c) => {
        const { done, total } = progressFor(c.id)
        const claimed = store.claimedRewards.includes(c.id)
        return {
          id: c.id,
          label: c.label,
          description: c.description,
          rewards: c.reward,
          done,
          total,
          claimed,
          // "unlocked" means the player has fulfilled the requirements; the
          // claim might still need to be issued (handled by checkClaimForTab).
          unlocked: total > 0 && done >= total,
        }
      })
  })

  // Called after a tab finishes successfully. If the tab's category just got
  // fully cleared (and we haven't claimed it before), grant the reward.
  function checkClaimForTab(tabId) {
    if (!tabId) return []
    const tab = (manifest.value?.tabs ?? []).find((t) => t.id === tabId)
    if (!tab) return []
    const cat = (manifest.value?.categories ?? []).find((c) => c.id === tab.category)
    if (!cat) return []
    if (!Array.isArray(cat.reward) || cat.reward.length === 0) return []
    if (store.claimedRewards.includes(cat.id)) return []
    if (!isCategoryComplete(cat.id)) return []
    const applied = store.claimCategoryReward(cat.id, cat.reward)
    return applied ?? []
  }

  return {
    categoriesWithRewards,
    checkClaimForTab,
    describeReward,
    isCategoryComplete,
  }
}
