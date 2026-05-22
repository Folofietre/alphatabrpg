import { ref } from 'vue'
import * as alphaTab from '@coderline/alphatab'
import { analyzeScore } from '@/utils/rpgEngine'
import { findPlayableTrack } from '@/utils/instruments'

const LABELS = ['Very easy', 'Easy', 'Medium', 'Hard', 'Very hard']

function difficultyToStars(d) {
  // 0..1 → 1..5. Clamp at the edges so the easiest tab still earns a single star.
  return Math.max(1, Math.min(5, Math.ceil(d * 5)))
}

// Module-scoped cache: tabId → { stars, label, loading, error }
const entries = ref({})

export function useTabDifficulty() {
  function ensure(tab, playerInstrument) {
    if (!tab?.id || !tab?.file) return
    if (entries.value[tab.id]) return // cached

    entries.value = { ...entries.value, [tab.id]: { loading: true } }

    alphaTab.importer.ScoreLoader.loadScoreAsync(
      tab.file,
      (score) => {
        const track = findPlayableTrack(score, playerInstrument) ?? score.tracks?.[0]
        const { estimatedDifficulty } = analyzeScore(score, track)
        const stars = difficultyToStars(estimatedDifficulty)
        entries.value = {
          ...entries.value,
          [tab.id]: { stars, label: LABELS[stars - 1] },
        }
      },
      (err) => {
        console.warn('[useTabDifficulty] parse failed for', tab.id, err)
        entries.value = { ...entries.value, [tab.id]: { error: true } }
      },
    )
  }

  function get(tabId) {
    return entries.value[tabId] ?? null
  }

  return { ensure, get, entries }
}
