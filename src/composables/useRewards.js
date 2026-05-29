import { computed, watch } from 'vue'
import { useTabsManifest } from '@/composables/useTabsManifest'
import { useCharacterStore } from '@/stores/character'
import { useTabDifficulty } from '@/composables/useTabDifficulty'

// Rewards engine. Rewards are configured in public/tabs/rewards.json and
// surfaced via the tabs manifest. Each reward has:
//   id      — unique string used to dedupe claims
//   label   — display name
//   hint    — short "how to unlock" line shown in the Bonus tab
//   trigger — { type, ...params }
//   effects — array of { stat, mode: 'flat'|'percent', value }
//
// Trigger types currently supported:
//   - category_completed: every playable tab in trigger.category has been
//     completed at least once.
// Adding a new trigger type means adding a case to `triggerSatisfied()`.
export function useRewards() {
  const { manifest } = useTabsManifest()
  const store = useCharacterStore()
  const difficulty = useTabDifficulty()

  // Reconcile flatBonuses + multipliers from claimedRewards × manifest as soon
  // as the manifest is available. Idempotent — re-runs on hot reload, manifest
  // updates, etc. Heals stale saves whose flatBonuses pre-dated the mirror.
  watch(
    () => manifest.value?.rewards,
    (rewards) => {
      if (!Array.isArray(rewards) || rewards.length === 0) return
      store.reconcileRewardState(rewards)
    },
    { immediate: true },
  )

  // Tabs in a category that the character's instrument can actually play.
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

  // Returns true if the reward's trigger condition is currently met.
  function triggerSatisfied(trigger) {
    if (!trigger || typeof trigger !== 'object') return false
    switch (trigger.type) {
      case 'category_completed':
        return isCategoryComplete(trigger.category)
      // Future:
      //   case 'time_played':       return store.totalMinutesPlayed >= trigger.minutes
      //   case 'songs_completed':   return totalCompletions() >= trigger.count
      //   case 'stat_threshold':    return store[trigger.stat] >= trigger.min
      default:
        return false
    }
  }

  function describeReward(effect) {
    if (!effect) return ''
    const sign = effect.value >= 0 ? '+' : ''
    const stat = effect.stat.charAt(0).toUpperCase() + effect.stat.slice(1)
    const unit = effect.mode === 'percent' ? '%' : ''
    return `${sign}${effect.value}${unit} ${stat}`
  }

  // Display-ready list for the Bonus tab. One entry per reward (each may have
  // multiple effects, rendered as a sub-list by the consumer).
  const rewardsList = computed(() =>
    (manifest.value?.rewards ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      hint: r.hint,
      effects: r.effects,
      unlocked: triggerSatisfied(r.trigger),
      claimed: store.claimedRewards.includes(r.id),
    })),
  )

  // Called after a tab finishes successfully. Walks every reward whose
  // trigger could plausibly have been activated by this completion (today
  // that's only `category_completed` matching the tab's category) and claims
  // those that satisfy their trigger and haven't been claimed yet.
  function checkClaimForTab(tabId) {
    if (!tabId) return []
    const tab = (manifest.value?.tabs ?? []).find((t) => t.id === tabId)
    if (!tab) return []
    const rewards = manifest.value?.rewards ?? []
    const applied = []
    for (const r of rewards) {
      if (store.claimedRewards.includes(r.id)) continue
      // Cheap pre-filter so we don't recompute every trigger every time.
      if (r.trigger?.type === 'category_completed' && r.trigger.category !== tab.category) {
        continue
      }
      if (!triggerSatisfied(r.trigger)) continue
      const claimed = store.claimReward(r.id, r.effects)
      if (claimed && claimed.length > 0) {
        applied.push({ id: r.id, label: r.label, effects: claimed })
      }
    }
    return applied
  }

  return {
    rewardsList,
    checkClaimForTab,
    describeReward,
    isCategoryComplete,
  }
}
