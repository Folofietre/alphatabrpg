import { ref } from 'vue'
import * as alphaTab from '@coderline/alphatab'
import { analyzeScore } from '@/utils/rpgEngine'
import { findPlayableTrack } from '@/utils/instruments'

const LABELS = ['Very easy', 'Easy', 'Medium', 'Hard', 'Very hard']

function difficultyToStars(d) {
  // 0..1 → 1..5. Clamp at the edges so the easiest tab still earns a single star.
  return Math.max(1, Math.min(5, Math.ceil(d * 5)))
}

// Module-scoped cache: tabId → { stars, label, playable, loading, error }
// `playable` reflects whether `findPlayableTrack(score, playerInstrument)`
// returned a non-null track. While `loading` is true, playability is unknown.
const entries = ref({})

export function useTabDifficulty() {
  function ensure(tab, playerInstrument) {
    if (!tab?.id || !tab?.file) return
    if (entries.value[tab.id]) return // cached

    entries.value = { ...entries.value, [tab.id]: { loading: true } }

    alphaTab.importer.ScoreLoader.loadScoreAsync(
      tab.file,
      (score) => {
        const playableTrack = findPlayableTrack(score, playerInstrument)
        const track = playableTrack ?? score.tracks?.[0]
        const { estimatedDifficulty } = analyzeScore(score, track)
        const stars = difficultyToStars(estimatedDifficulty)
        entries.value = {
          ...entries.value,
          [tab.id]: {
            stars,
            label: LABELS[stars - 1],
            playable: playableTrack !== null,
          },
        }
      },
      (err) => {
        console.warn('[useTabDifficulty] parse failed for', tab.id, err)
        entries.value = {
          ...entries.value,
          // Failed to parse → treat as non-playable so we don't strand the
          // player on a broken tab they can never load.
          [tab.id]: { error: true, playable: false },
        }
      },
    )
  }

  function get(tabId) {
    return entries.value[tabId] ?? null
  }

  // Tri-state: true / false / null (unknown — still parsing).
  function isPlayable(tabId) {
    const e = entries.value[tabId]
    if (!e || e.loading) return null
    return e.playable === true
  }

  return { ensure, get, isPlayable, entries }
}
