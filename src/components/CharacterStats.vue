<template>
  <section class="stats">
    <header class="identity">
      <img
        v-if="instrumentMeta?.avatar"
        :src="instrumentMeta.avatar"
        :alt="`${instrumentMeta.label} portrait`"
        :title="instrumentMeta.label"
        class="avatar"
        draggable="false"
      />
      <div>
        <h2>{{ store.character.name }}</h2>
        <p v-if="instrumentMeta" class="role">{{ instrumentMeta.label }}</p>
      </div>
    </header>
    <div v-for="stat in stats" :key="stat.key" class="stat">
      <label :title="stat.hint">{{ stat.label }}</label>
      <div class="bar" :title="`Next milestone: ${stat.milestone}`">
        <div class="fill" :style="{ width: `${stat.ratio * 100}%` }" />
      </div>
      <span class="value">{{ stat.value }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { INSTRUMENT_META } from '@/utils/instruments'

const store = useCharacterStore()
const instrumentMeta = computed(() => INSTRUMENT_META[store.character.instrument] ?? null)

import { MILESTONE_STEP } from '@/stores/character'

// Next milestone above the current value. Milestones are every MILESTONE_STEP
// (50) points. Once reached, a milestone becomes the new lower bound for the
// stat — the store ratchets the floor up so the player can never drop back.
function milestoneFor(stat) {
  return Math.floor(stat / MILESTONE_STEP) * MILESTONE_STEP + MILESTONE_STEP
}

const HINTS = {
  speed: 'Comfort speed scales with this stat. Push above to grow.',
  dexterity: 'Drives the per-beat hit roll. Higher = fewer wrong notes.',
  endurance: 'Maximum notes per run before you collapse from fatigue.',
}

// Round to at most 2 decimals. Trailing zeros are stripped (Number(...))
// so a clean 30 stays "30" and 11.4 stays "11.4" rather than "11.40".
function formatStat(v) {
  return Number((v ?? 0).toFixed(2))
}

function statRow(key, label, value, floor) {
  const next = milestoneFor(value)
  const prev = next - MILESTONE_STEP
  return {
    key,
    label,
    value: formatStat(value),
    milestone: next,
    floor,
    // Progress inside the current 50-point segment.
    ratio: Math.max(0, Math.min(1, (value - prev) / MILESTONE_STEP)),
    hint: HINTS[key] ?? '',
  }
}

const stats = computed(() => [
  statRow('speed', 'Speed', store.character.speed, store.floors.speed),
  statRow('dexterity', 'Dexterity', store.character.dexterity, store.floors.dexterity),
  statRow('endurance', 'Endurance', store.character.endurance, store.floors.endurance),
])
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.stats {
  @include panel-card;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }
}
.identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}
.avatar {
  width: 48px;
  height: 62px;
  object-fit: cover;
  background: var(--bg-surface);
  border: 1px solid var(--panel-border);
  user-select: none;
  -webkit-user-drag: none;
  flex-shrink: 0;
}
.role {
  @include section-label;
  margin: 0;
  opacity: 0.7;
}
.stat {
  display: grid;
  grid-template-columns: 90px 1fr 60px;
  align-items: center;
  gap: 0.5rem;

  label {
    font-size: 0.9rem;
    opacity: 0.85;
  }
}
.bar {
  @include progress-track(12px);
}
.fill {
  @include progress-fill;
}
.value {
  @include tabular;
  text-align: right;
  font-size: 0.85rem;
  opacity: 0.85;
}
</style>
