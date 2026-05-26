<template>
  <span
    class="difficulty"
    :class="{ loading: !info, error: info?.error }"
    :title="title"
  >
    <span
      v-for="n in 5"
      :key="n"
      class="star"
      :class="{ filled: n <= (info?.stars ?? 0) }"
      aria-hidden="true"
    >★</span>
    <span v-if="info?.error" class="note">?</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  info: { type: Object, default: null }, // { stars, label } | { error: true } | { loading: true } | null
})

const title = computed(() => {
  if (!props.info || props.info.loading) return 'Analysing…'
  if (props.info.error) return 'Could not analyse'
  return `Difficulty: ${props.info.label}`
})
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.difficulty {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-size: 0.8rem;
  line-height: 1;
  letter-spacing: 0.5px;

  &.loading .star { opacity: 0.5; }
  &.error   .star { display: none; }
}
.star {
  color: var(--panel-border);
  transition: color 0.2s;

  &.filled { color: var(--palm-leaf); }
}
.note {
  margin-left: 2px;
  font-size: 0.75rem;
  opacity: 0.6;
}
</style>
