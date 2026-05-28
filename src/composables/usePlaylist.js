import { computed, ref } from 'vue'
import { useTabSelection } from '@/composables/useTabSelection'
import { useCharacterStore } from '@/stores/character'

// Consecutive-completion bonus multiplier table.
// Index = number of consecutive completes already accumulated.
const BONUS_TABLE = [1.0, 1.0, 1.1, 1.2, 1.3]

function bonusFor(consecutive) {
  if (consecutive <= 1) return 1.0
  if (consecutive >= 4) return BONUS_TABLE[4]
  return BONUS_TABLE[consecutive]
}

// Slider bounds — kept in sync with PlaylistColumn.
export const SPEED_MIN = 0.20
export const SPEED_MAX = 1.00

export function clampSpeed(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, v))
}

// Derive the player's comfort speed for a song given its onset rate.
// Returns null when onsetRate isn't known yet (first-load case).
export function comfortFor(speedStat, onsetRate) {
  if (!onsetRate || onsetRate <= 0) return null
  return Math.min(SPEED_MAX, (speedStat ?? 0) / onsetRate)
}

const queue = ref([])              // array of full tab objects (id, title, artist, file, category)
const currentIndex = ref(-1)       // index of the tab currently loaded
const playedIndexes = ref(new Set())// indexes of queue entries completed during the current run
const consecutive = ref(0)         // consecutive completions in the current run
const isRunning = ref(false)       // true between first Play and end-of-run
const autoPlayPending = ref(false) // set true when a chained tab is queued; consumed once by useAlphaTab

export function usePlaylist() {
  const { selectTab } = useTabSelection()

  const length = computed(() => queue.value.length)
  const currentTab = computed(() =>
    currentIndex.value >= 0 ? queue.value[currentIndex.value] ?? null : null,
  )
  const hasNext = computed(() => currentIndex.value < queue.value.length - 1)
  // Multiplier that has been earned so far (display label in the UI).
  const bonusMultiplier = computed(() => bonusFor(consecutive.value))
  // Multiplier that would apply if the current song completes right now.
  const pendingBonusMultiplier = computed(() => bonusFor(consecutive.value + 1))

  function append(tab) {
    if (!tab?.id) return
    // Seed the selected speed:
    // - First-time queue (no cached onset rate) → 100%. The player has no idea
    //   what their comfort speed is yet; they queue at full tempo and discover.
    // - Subsequent queues (onset rate cached after first load) → comfort speed.
    const store = useCharacterStore()
    const record = store.tabRecords?.[tab.id]
    const seedSpeed = record?.onsetRate != null
      ? (clampSpeed(comfortFor(store.character.speed, record.onsetRate)) ?? SPEED_MAX)
      : SPEED_MAX
    const entry = { ...tab, selectedSpeed: seedSpeed }
    // Duplicates are allowed: the user can queue the same song multiple times
    // in a row to practice it.
    queue.value = [...queue.value, entry]
    // First tab → load immediately and mark as current (user still presses Play).
    if (queue.value.length === 1) {
      currentIndex.value = 0
      selectTab(tab)
    }
  }

  // Called when useAlphaTab has just parsed the score and computed the comfort
  // speed for the current entry. Resolves a null selectedSpeed to the comfort
  // value so the slider reads correctly from now on.
  function resolveSelectedSpeed(index, fallback) {
    const entries = queue.value
    if (index < 0 || index >= entries.length) return
    if (entries[index].selectedSpeed != null) return
    const next = entries.slice()
    next[index] = { ...next[index], selectedSpeed: clampSpeed(fallback) }
    queue.value = next
  }

  function setSelectedSpeedAt(index, value) {
    const entries = queue.value
    if (index < 0 || index >= entries.length) return
    const next = entries.slice()
    next[index] = { ...next[index], selectedSpeed: clampSpeed(value) }
    queue.value = next
  }

  function removeAt(index) {
    if (index < 0 || index >= queue.value.length) return
    // Can't remove the currently-playing track.
    if (index === currentIndex.value && isRunning.value) return

    const next = queue.value.filter((_, i) => i !== index)
    queue.value = next
    // Adjust currentIndex if we removed before it.
    if (index < currentIndex.value) {
      currentIndex.value = currentIndex.value - 1
    } else if (index === currentIndex.value) {
      // Removed the loaded-but-not-running current. Reset selection.
      currentIndex.value = next.length > 0 ? Math.min(index, next.length - 1) : -1
      if (currentIndex.value >= 0) selectTab(next[currentIndex.value])
    }
    // Shift played indexes accordingly so the ✓ marks stay aligned.
    const nextPlayed = new Set()
    for (const i of playedIndexes.value) {
      if (i < index) nextPlayed.add(i)
      else if (i > index) nextPlayed.add(i - 1)
      // i === index: drop it (we just removed that entry)
    }
    playedIndexes.value = nextPlayed
  }

  function clear() {
    if (isRunning.value) return // safety: don't wipe an in-progress run
    queue.value = []
    currentIndex.value = -1
    playedIndexes.value = new Set()
    consecutive.value = 0
  }

  // Called when the first Play happens (or when a song actually starts playing).
  function markRunStarted() {
    if (isRunning.value) return
    isRunning.value = true
    playedIndexes.value = new Set()
    consecutive.value = 0
  }

  // Called on outcome === 'completed' to record + advance to the next tab.
  // Returns the next tab to load (or null if the playlist is finished).
  // When a next tab exists, it also triggers the load via useTabSelection and
  // arms an auto-play flag so useAlphaTab plays it without user interaction.
  function onSongCompleted() {
    if (currentIndex.value >= 0) {
      playedIndexes.value = new Set([...playedIndexes.value, currentIndex.value])
    }
    consecutive.value += 1

    if (currentIndex.value < queue.value.length - 1) {
      currentIndex.value += 1
      const nextTab = queue.value[currentIndex.value]
      autoPlayPending.value = true
      selectTab(nextTab)
      return nextTab
    }
    // Playlist finished naturally.
    isRunning.value = false
    return null
  }

  function consumeAutoPlay() {
    const v = autoPlayPending.value
    autoPlayPending.value = false
    return v
  }

  // Called on 'stopped' or 'exhausted'. Aborts the run entirely.
  function onRunAborted() {
    consecutive.value = 0
    isRunning.value = false
  }

  // Called by the Replay button on the post-playlist panel.
  // Returns the first tab to load. Arms auto-play so the user does not have to
  // click Play again after the post-playlist panel disappears.
  function restart() {
    if (queue.value.length === 0) return null
    currentIndex.value = 0
    playedIndexes.value = new Set()
    consecutive.value = 0
    isRunning.value = false // becomes true when playPause is called
    autoPlayPending.value = true
    selectTab(queue.value[0])
    return queue.value[0]
  }

  // Per-index check: the same tab can appear multiple times; each entry has
  // its own played state.
  function isPlayedAt(index) {
    return playedIndexes.value.has(index)
  }

  // Per-tab check: is this tab anywhere in the queue?
  function isQueued(tabId) {
    return queue.value.some((t) => t.id === tabId)
  }

  return {
    // state
    queue,
    currentIndex,
    currentTab,
    length,
    hasNext,
    playedIndexes,
    consecutive,
    bonusMultiplier,
    pendingBonusMultiplier,
    isRunning,
    // actions
    append,
    removeAt,
    clear,
    markRunStarted,
    onSongCompleted,
    onRunAborted,
    restart,
    isPlayedAt,
    isQueued,
    consumeAutoPlay,
    resolveSelectedSpeed,
    setSelectedSpeedAt,
  }
}
