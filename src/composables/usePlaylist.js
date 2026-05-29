import { computed, ref } from 'vue'
import { useTabSelection } from '@/composables/useTabSelection'
import { useCharacterStore } from '@/stores/character'

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

// Slider bounds — kept in sync with PlaylistColumn.
export const SPEED_MIN = 0.20
export const SPEED_MAX = 1.00

export function clampSpeed(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, v))
}

// Comfort speed for a given song. Returns null when onsetRate isn't known yet.
export function comfortFor(speedStat, onsetRate) {
  if (!onsetRate || onsetRate <= 0) return null
  return Math.min(SPEED_MAX, (speedStat ?? 0) / onsetRate)
}

// Streak multiplier applied to positive XP gains. Index = consecutive completes.
const BONUS_TABLE = [1.0, 1.0, 1.1, 1.2, 1.3]
function bonusFor(consecutive) {
  if (consecutive <= 1) return 1.0
  if (consecutive >= 4) return BONUS_TABLE[4]
  return BONUS_TABLE[consecutive]
}

function freshXP() {
  return { speed: 0, dexterity: 0, endurance: 0, stretchSpeed: 0 }
}

// ---------------------------------------------------------------------------
// Singleton state — a single playlist is shared across the app.
// ---------------------------------------------------------------------------

// Queue of tab entries with their selected playback speed:
//   { id, title, artist, file, category, selectedSpeed }
const queue = ref([])

// Active run index. -1 means no run is active. 0..length-1 during a run.
// This single ref is the source of truth for "are we in a run?" — derived
// by `isRunning` below.
const runIndex = ref(-1)

// Per-song breakdown for the current/most-recent run. Cleared at `startRun`.
const runSongs = ref([])

// Aggregated XP for the current/most-recent run. Cleared at `startRun`.
const runXP = ref(freshXP())

// Consecutive completes within the active run (drives the streak multiplier).
const consecutive = ref(0)

// ---------------------------------------------------------------------------

export function usePlaylist() {
  const { selectTab } = useTabSelection()
  const store = useCharacterStore()

  const length = computed(() => queue.value.length)
  const isRunning = computed(() => runIndex.value >= 0)
  const currentTab = computed(() =>
    runIndex.value >= 0 ? queue.value[runIndex.value] ?? null : null,
  )
  const hasNext = computed(() => runIndex.value >= 0 && runIndex.value < queue.value.length - 1)
  const bonusMultiplier = computed(() => bonusFor(consecutive.value))
  const pendingBonusMultiplier = computed(() => bonusFor(consecutive.value + 1))

  // ---- Queue mutations (outside a run only; locked during a run) ----------

  function appendTab(tab) {
    if (!tab?.id) return
    // Seed the slider:
    // - Never played (no cached onsetRate): start at 100%.
    // - Already played at least once: start at the player's comfort speed.
    const record = store.tabRecords?.[tab.id]
    const seedSpeed = record?.onsetRate != null
      ? (clampSpeed(comfortFor(store.character.speed, record.onsetRate)) ?? SPEED_MAX)
      : SPEED_MAX
    const entry = { ...tab, selectedSpeed: seedSpeed }

    const wasEmpty = queue.value.length === 0
    queue.value = [...queue.value, entry]
    // Load the first queued tab into the player so the user sees the score and
    // can adjust the slider before pressing Play.
    if (wasEmpty) selectTab(entry)
  }

  function removeAt(index) {
    if (index < 0 || index >= queue.value.length) return
    if (isRunning.value) return // queue locked during a run

    const next = queue.value.filter((_, i) => i !== index)
    queue.value = next
    // If we just removed the entry currently loaded in the player and the
    // queue still has entries, swap the loaded score to the new first entry.
    // Otherwise (empty queue) nothing else to do.
    if (index === 0 && next.length > 0) {
      selectTab(next[0])
    }
  }

  function clear() {
    if (isRunning.value) return
    queue.value = []
    runSongs.value = []
    runXP.value = freshXP()
    consecutive.value = 0
  }

  function setSelectedSpeedAt(index, value) {
    if (index < 0 || index >= queue.value.length) return
    const next = queue.value.slice()
    next[index] = { ...next[index], selectedSpeed: clampSpeed(value) ?? SPEED_MAX }
    queue.value = next
  }

  // ---- Visual helpers -----------------------------------------------------

  // During a run: indices strictly less than the current runIndex are "played".
  // Between runs (runIndex === -1): nothing is marked — the result panel takes
  // over the post-run display.
  function isPlayedAt(idx) {
    return isRunning.value && idx < runIndex.value
  }

  function isQueued(tabId) {
    return queue.value.some((t) => t.id === tabId)
  }

  // ---- Run lifecycle ------------------------------------------------------

  // Start a fresh run from index 0. Used by both Play and Replay buttons —
  // they're the same action.
  function startRun() {
    if (queue.value.length === 0) return false
    runSongs.value = []
    runXP.value = freshXP()
    consecutive.value = 0
    runIndex.value = 0
    selectTab(queue.value[0])
    return true
  }

  // Single advance path. The caller (`useAlphaTab`) passes the song's data
  // for the per-song breakdown + XP accumulation, and we either chain to the
  // next song (returning 'chained') or end the run (returning 'finished').
  function recordSongAndStep(song) {
    runSongs.value = [...runSongs.value, song]
    if (song.xpGained) {
      const acc = runXP.value
      runXP.value = {
        speed: acc.speed + (song.xpGained.speed ?? 0),
        dexterity: acc.dexterity + (song.xpGained.dexterity ?? 0),
        endurance: acc.endurance + (song.xpGained.endurance ?? 0),
        stretchSpeed: acc.stretchSpeed + (song.xpGained.stretchSpeed ?? 0),
      }
    }
    if (song.outcome === 'completed') consecutive.value += 1
    else consecutive.value = 0

    const canChain = song.outcome === 'completed' && runIndex.value < queue.value.length - 1
    if (canChain) {
      runIndex.value += 1
      selectTab(queue.value[runIndex.value])
      return 'chained'
    }
    runIndex.value = -1
    return 'finished'
  }

  // Build the SessionResult payload from the just-finished run. The outcome
  // passed in is the *run's* outcome (matches the last song's outcome for
  // stopped/exhausted, or 'completed' when the last song completed naturally).
  function aggregateResult({ outcome }) {
    const songs = runSongs.value.slice()
    const isMulti = songs.length > 1
    const totalBeats = songs.reduce((s, x) => s + (x.beatCount || 0), 0)
    const totalSuccess = songs.reduce(
      (s, x) => s + (x.beatCount || 0) * (x.accuracy ?? 0),
      0,
    )
    const aggAccuracy = totalBeats > 0 ? totalSuccess / totalBeats : 0
    let lastPB = null
    for (const s of songs) {
      if (s.recordDelta?.scorePB) lastPB = s.recordDelta
    }
    const lastSong = songs[songs.length - 1] ?? null

    return {
      tabId: isMulti ? null : (lastSong?.tabId ?? null),
      title: isMulti ? 'Playlist run' : (lastSong?.title || 'Unknown score'),
      accuracy: aggAccuracy,
      outcome,
      beatCount: totalBeats,
      xpGained: { ...runXP.value },
      recordDelta: isMulti ? lastPB : (lastSong?.recordDelta ?? null),
      tooShort: totalBeats < 10,
      playlistFinished: outcome === 'completed',
      selectedSpeed: isMulti ? null : (lastSong?.selectedSpeed ?? null),
      comfortSpeed: isMulti ? null : (lastSong?.comfortSpeed ?? null),
      aboveComfort: isMulti ? false : (lastSong?.aboveComfort ?? false),
      songs: isMulti ? songs : null,
      lastPB,
      songsCompletedCount: songs.filter((s) => s.outcome === 'completed').length,
      songsAttemptedCount: songs.length,
    }
  }

  return {
    // state
    queue,
    length,
    isRunning,
    runIndex,
    currentIndex: runIndex, // alias kept for templates that read `currentIndex`
    currentTab,
    hasNext,
    consecutive,
    bonusMultiplier,
    pendingBonusMultiplier,
    runSongs,
    runXP,
    // queue ops
    appendTab,
    removeAt,
    clear,
    setSelectedSpeedAt,
    isPlayedAt,
    isQueued,
    // run lifecycle
    startRun,
    recordSongAndStep,
    aggregateResult,
  }
}
