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
      <li>
        <span>Outcome</span>
        <strong>{{ outcomeLabel }}</strong>
      </li>
    </ul>

    <p v-if="result.tooShort" class="too-short">
      Too short to count. No XP, no penalty.
    </p>

    <template v-else>
      <h4>{{ anyGain ? 'Gains & losses' : 'No changes' }}</h4>
      <p v-if="result.bonusMultiplier" class="bonus-line">
        Streak bonus: ×{{ result.bonusMultiplier.toFixed(2) }} applied to positive gains.
      </p>
      <ul class="gains">
        <li>
          Speed
          <strong :class="signClass(result.xpGained.speed)">
            {{ signed(Math.round(result.xpGained.speed)) }} opm
          </strong>
        </li>
        <li>
          Dexterity
          <strong :class="signClass(result.xpGained.dexterity)">
            {{ signedPct(result.xpGained.dexterity) }}
          </strong>
        </li>
        <li>
          Endurance
          <strong :class="signClass(result.xpGained.endurance)">
            {{ signed(Math.round(result.xpGained.endurance)) }} notes
          </strong>
        </li>
      </ul>
    </template>

    <button class="replay" @click="$emit('replay')">{{ replayLabel }}</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

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

function signed(n) {
  if (n > 0) return `+${n}`
  return `${n}`
}
function signedPct(v) {
  const sign = v > 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
}
function signClass(v) {
  if (v > 0) return 'gain-positive'
  if (v < 0) return 'gain-negative'
  return 'gain-neutral'
}
</script>

<style scoped>
.session-result {
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.session-result.outcome-stopped {
  background: var(--warn-bg);
  border-color: var(--warn-border);
}
.session-result.outcome-exhausted {
  background: rgba(108, 88, 76, 0.10);
  border-color: rgba(108, 88, 76, 0.40);
}
.session-result h3 {
  margin: 0;
}
.session-result h4 {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  opacity: 0.85;
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
}
.metrics li,
.gains li {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.85rem;
  opacity: 0.9;
}
.metrics strong,
.gains strong {
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}
.gain-positive {
  color: var(--gain);
}
.gain-negative {
  color: var(--loss);
}
.gain-neutral {
  opacity: 0.6;
}
.bonus-line {
  margin: 0;
  font-size: 0.85rem;
  color: var(--palm-leaf);
}
.replay {
  align-self: flex-start;
  margin-top: 0.25rem;
}
</style>
