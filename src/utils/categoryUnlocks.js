// Recursive evaluator for category unlock rules.
//
// `ctx` is a shape like:
//   {
//     tabsByCategory:        { [categoryId]: string[] }  // all tab ids per category
//     completedTabsSet:      Set<string>                 // tab ids completed at least once
//     character:             { speed, dexterity, endurance }
//   }
export function evaluateUnlock(rule, ctx) {
  if (!rule) return true

  switch (rule.type) {
    case 'always':
      return true

    case 'all_completed': {
      const tabs = ctx.tabsByCategory?.[rule.category] ?? []
      // If the category has zero tabs *for this character's instrument*, the
      // rule is trivially satisfied — otherwise the player would be locked
      // behind a category they can't even see.
      if (tabs.length === 0) return true
      return tabs.every((tabId) => ctx.completedTabsSet?.has(tabId))
    }

    case 'stat_threshold': {
      const value = ctx.character?.[rule.stat] ?? 0
      return value >= (rule.min ?? 0)
    }

    case 'any_of':
      return (rule.rules ?? []).some((r) => evaluateUnlock(r, ctx))

    case 'all_of':
      return (rule.rules ?? []).every((r) => evaluateUnlock(r, ctx))

    default:
      console.warn('[categoryUnlocks] unknown rule type:', rule?.type)
      return false
  }
}

// Build a context object from manifest + character store state.
// `tabRecords` is the v6 per-tab record map; a tab is "completed" for the
// purpose of unlocks when its `completionsCount > 0`.
export function buildUnlockContext({ tabs, tabRecords, character }) {
  const tabsByCategory = {}
  for (const tab of tabs ?? []) {
    if (!tabsByCategory[tab.category]) tabsByCategory[tab.category] = []
    tabsByCategory[tab.category].push(tab.id)
  }
  const completedTabsSet = new Set(
    Object.entries(tabRecords ?? {})
      .filter(([, rec]) => (rec?.completionsCount ?? 0) > 0)
      .map(([id]) => id),
  )
  return { tabsByCategory, completedTabsSet, character: character ?? {} }
}
