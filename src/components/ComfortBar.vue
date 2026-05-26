<template>
  <span class="comfort" :title="title" :aria-label="title">
    <span
      v-for="i in SEGMENTS"
      :key="i"
      class="seg"
      :class="{
        filled: i <= filled,
        penalty: i <= filled && i <= NEUTRAL_INDEX,
        bonus: i <= filled && i > NEUTRAL_INDEX,
      }"
    >
      <span v-if="i === NEUTRAL_INDEX" class="neutral-mark" aria-hidden="true" />
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { FAMILIARITY_CAP, FAMILIARITY_NEUTRAL } from '@/utils/rpgEngine'

const SEGMENTS = 4
// Index (1-based) at or below which we're in the penalty zone.
const NEUTRAL_INDEX = Math.round((FAMILIARITY_NEUTRAL / FAMILIARITY_CAP) * SEGMENTS)

const props = defineProps({
  familiarity: { type: Number, default: 0 },
})

const filled = computed(() => {
  const ratio = Math.max(0, Math.min(1, props.familiarity / FAMILIARITY_CAP))
  return Math.round(ratio * SEGMENTS)
})

const title = computed(() => {
  const shift = (props.familiarity ?? 0) - FAMILIARITY_NEUTRAL
  const pct = Math.round(props.familiarity * 100)
  if (Math.abs(shift) < 0.005) return `Comfort: ${pct}% (neutral on this song)`
  const sign = shift > 0 ? '+' : '−'
  const mag = Math.abs(Math.round(shift * 100))
  return `Comfort: ${pct}% (${sign}${mag}% Dexterity on this song)`
})
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.comfort {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  vertical-align: middle;
}
.seg {
  position: relative;
  width: 10px;
  height: 8px;
  border-radius: 2px;
  background: var(--panel-strong);
  transition: background-color 0.2s;

  &.filled.penalty { background: var(--faded-copper); }
  &.filled.bonus   { background: var(--palm-leaf); }
}
.neutral-mark {
  position: absolute;
  top: -2px;
  bottom: -2px;
  right: -2px;
  width: 1px;
  background: var(--text-muted);
  opacity: 0.7;
  border-radius: 1px;
}
</style>
