<template>
  <aside class="rewards">
    <header class="rewards-header">
      <h2>Rewards</h2>
      <span class="hint">Clear a category to unlock its reward.</span>
    </header>

    <p v-if="categoriesWithRewards.length === 0" class="empty">
      No categories have rewards yet.
    </p>

    <ul v-else class="list">
      <li
        v-for="cat in categoriesWithRewards"
        :key="cat.id"
        class="card"
        :class="{ claimed: cat.claimed, unlocked: cat.unlocked && !cat.claimed }"
      >
        <header class="card-head">
          <span class="marker" aria-hidden="true">
            {{ cat.claimed ? '✓' : (cat.unlocked ? '★' : '🔒') }}
          </span>
          <span class="title">{{ cat.label }}</span>
          <span class="progress">{{ cat.done }} / {{ cat.total }}</span>
        </header>
        <ul class="rewards-list">
          <li v-for="(r, i) in cat.rewards" :key="i" class="reward-row">
            <span class="reward-label">{{ r.label || describeReward(r) }}</span>
            <span class="reward-value">{{ describeReward(r) }}</span>
          </li>
        </ul>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { useRewards } from '@/composables/useRewards'

const { categoriesWithRewards, describeReward } = useRewards()
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.rewards {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.rewards-header {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;

  h2 {
    @include section-label;
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.02em;
    opacity: 0.85;
  }
  .hint {
    @include hint-text;
    font-size: 0.78rem;
  }
}
.empty {
  @include hint-text;
  margin: 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.card {
  @include panel-card;
  padding: 0.5rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  opacity: 0.7;
  transition:
    border-color $transition-fast,
    background-color $transition-fast,
    opacity $transition-fast;

  &.unlocked { opacity: 0.95; border-color: var(--accent-border); }
  &.claimed {
    opacity: 1;
    border-color: var(--accent);
    background: var(--accent-bg);
  }
}
.card-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}
.marker {
  @include tabular;
  width: 1.25rem;
  text-align: center;
  flex-shrink: 0;
  font-size: 0.95rem;
}
.title {
  flex: 1;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.progress {
  @include tabular;
  font-size: 0.75rem;
  opacity: 0.75;
}
.rewards-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.reward-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8rem;
}
.reward-label {
  font-style: italic;
  opacity: 0.85;
}
.reward-value {
  @include tabular;
  font-weight: 600;
  color: var(--palm-leaf);
}
</style>
