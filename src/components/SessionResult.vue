<template>
  <div class="session-result" :class="`outcome-${result.outcome}`">
    <h3>{{ headline }}</h3>
    <p class="title">{{ result.title }}</p>

    <ul class="metrics">
      <li>
        <span>Accuracy</span>
        <strong>{{ Math.round(result.accuracy * 100) }}%</strong>
      </li>
      <li>
        <span>Beats played</span>
        <strong>{{ result.beatCount }}</strong>
      </li>
      <li v-if="result.selectedSpeed != null">
        <span>Speed</span>
        <strong>
          {{ Math.round(result.selectedSpeed * 100) }}%
          <em v-if="result.aboveComfort" class="above-comfort">stretched</em>
        </strong>
      </li>
      <li>
        <span>Outcome</span>
        <strong>{{ outcomeLabel }}</strong>
      </li>
    </ul>

    <p v-if="result.tooShort" class="too-short">
      Too short to count. No XP, no penalty.
    </p>

    <template v-else>
      <p v-if="recordDelta?.scorePB" class="high-score">
        🏆 New high score!
        <strong>
          {{ formatScore(recordDelta.scoreBefore) }} → {{ formatScore(recordDelta.scoreAfter) }}
        </strong>
        <em v-if="stretchTag" class="stretch-tag">{{ stretchTag }}</em>
      </p>
      <p v-else-if="currentScoreLine" class="score-line">
        🏆 <strong>{{ currentScoreLine }}</strong>
      </p>

      <h4>{{ anyGain ? 'Gains & losses' : 'No changes' }}</h4>
      <p v-if="result.bonusMultiplier" class="bonus-line">
        Streak bonus: ×{{ result.bonusMultiplier.toFixed(2) }} applied to positive gains.
      </p>
      <p v-if="stretchBonus > 0" class="bonus-line">
        Stretch bonus: +{{ stretchBonus }} Speed for pushing past comfort.
      </p>
      <ul class="gains">
        <li>
          Speed
          <strong :class="signClass(result.xpGained.speed)">
            {{ signed(Math.round(result.xpGained.speed)) }}
          </strong>
        </li>
        <li>
          Dexterity
          <strong :class="signClass(result.xpGained.dexterity)">
            {{ signed(Math.round(result.xpGained.dexterity)) }}
          </strong>
        </li>
        <li>
          Endurance
          <strong :class="signClass(result.xpGained.endurance)">
            {{ signed(Math.round(result.xpGained.endurance)) }}
          </strong>
        </li>
      </ul>

      <div v-if="recordDelta" class="comfort-row">
        <span class="comfort-label">Comfort</span>
        <ComfortBar :familiarity="recordDelta.familiarityBefore" />
        <span class="comfort-arrow">→</span>
        <ComfortBar :familiarity="recordDelta.familiarityAfter" />
        <span v-if="crossedNeutral" class="milestone">You know this song now.</span>
      </div>
    </template>

    <button class="replay" @click="$emit('replay')">{{ replayLabel }}</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FAMILIARITY_NEUTRAL } from '@/utils/rpgEngine'
import ComfortBar from './ComfortBar.vue'

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
  playlistLength: {
    type: Number,
    default: 0,
  },
})
defineEmits(['replay'])

const replayLabel = computed(() =>
  props.playlistLength > 1 ? 'Replay playlist' : 'Replay',
)

const HEADLINES = {
  completed: 'Session complete',
  stopped: 'Gave up',
  exhausted: 'Collapsed from exhaustion',
}
const OUTCOMES = {
  completed: 'Finished',
  stopped: 'Stopped',
  exhausted: 'Exhausted',
}

const headline = computed(() => HEADLINES[props.result.outcome] ?? 'Session ended')
const outcomeLabel = computed(() => OUTCOMES[props.result.outcome] ?? '—')
const anyGain = computed(() => {
  const g = props.result.xpGained
  return g && (g.speed !== 0 || g.dexterity !== 0 || g.endurance !== 0)
})
const recordDelta = computed(() => props.result.recordDelta ?? null)

// Score line shown when the player completed the song but did not beat
// their previous best (a celebration line takes over in that case).
const currentScoreLine = computed(() => {
  if (props.result.outcome !== 'completed') return null
  if (recordDelta.value?.scorePB) return null // shown via the celebration line
  if (recordDelta.value?.scoreAfter != null) {
    return formatScore(recordDelta.value.scoreAfter)
  }
  return null
})

const stretchBonus = computed(() => Math.round(props.result.xpGained?.stretchSpeed ?? 0))
const stretchTag = computed(() => {
  if (!props.result.aboveComfort) return ''
  if (props.result.comfortSpeed == null || props.result.selectedSpeed == null) return ''
  const delta = Math.round((props.result.selectedSpeed - props.result.comfortSpeed) * 100)
  if (delta <= 0) return ''
  return `at +${delta}% above comfort`
})

const crossedNeutral = computed(() => {
  const d = recordDelta.value
  if (!d) return false
  return (
    (d.familiarityBefore ?? 0) < FAMILIARITY_NEUTRAL
    && (d.familiarityAfter ?? 0) >= FAMILIARITY_NEUTRAL
  )
})

function signed(n) {
  if (n > 0) return `+${n}`
  return `${n}`
}
function signClass(v) {
  if (v > 0) return 'gain-positive'
  if (v < 0) return 'gain-negative'
  return 'gain-neutral'
}
function formatScore(n) {
  if (n == null) return '—'
  return Math.round(n).toLocaleString()
}
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.session-result {
  padding: 1rem 1.25rem;
  border-radius: $radius-md;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &.outcome-stopped {
    background: var(--warn-bg);
    border-color: var(--warn-border);
  }
  &.outcome-exhausted {
    background: rgba(108, 88, 76, 0.10);
    border-color: rgba(108, 88, 76, 0.40);
  }

  h3 { margin: 0; }
  h4 {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    opacity: 0.85;
  }
}
.title {
  margin: 0;
  opacity: 0.8;
  font-style: italic;
}
.too-short {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  opacity: 0.75;
  font-style: italic;
}
.metrics,
.gains {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;

  li {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    font-size: 0.85rem;
    opacity: 0.9;
  }

  strong {
    @include tabular;
    font-size: 1rem;
  }
}
.gain-positive { color: var(--gain); }
.gain-negative { color: var(--loss); }
.gain-neutral  { opacity: 0.6; }

.bonus-line {
  margin: 0;
  font-size: 0.85rem;
  color: var(--palm-leaf);
}
.above-comfort {
  margin-left: 0.35rem;
  font-size: 0.7rem;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.75;
  color: var(--faded-copper);
}
.stretch-tag {
  margin-left: 0.4rem;
  font-style: italic;
  font-size: 0.78rem;
  opacity: 0.8;
}
.high-score {
  margin: 0.25rem 0;
  padding: 0.55rem 0.75rem;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: $radius-sm;
  font-size: 0.95rem;
  color: var(--palm-leaf);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  strong { @include tabular; }
}
.score-line {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.9;
}
.comfort-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
  font-size: 0.85rem;
  flex-wrap: wrap;
}
.comfort-label {
  @include section-label;
  font-size: 0.75rem;
  opacity: 0.7;
}
.comfort-arrow { opacity: 0.7; }
.milestone {
  font-size: 0.78rem;
  font-style: italic;
  color: var(--palm-leaf);
}
.replay {
  align-self: flex-start;
  margin-top: 0.25rem;
}
</style>
