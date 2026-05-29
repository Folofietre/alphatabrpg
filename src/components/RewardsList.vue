<template>
  <aside class="rewards">
    <header class="rewards-header">
      <h2>Bonus</h2>
    </header>

    <p v-if="rewards.length === 0" class="empty">
      No bonuses configured yet.
    </p>

    <ul v-else class="list">
      <li
        v-for="r in rewards"
        :key="r.id"
        class="card"
        :class="{ claimed: r.claimed, unlocked: r.unlocked && !r.claimed }"
      >
        <header class="card-head">
          <span class="marker" aria-hidden="true">
            {{ r.claimed ? '✓' : (r.unlocked ? '★' : '🔒') }}
          </span>
          <span class="title">{{ r.label }}</span>
        </header>
        <p v-if="r.hint" class="hint">{{ r.hint }}</p>
        <ul class="effects">
          <li v-for="(e, i) in r.effects" :key="i" class="effect-row">
            <span class="effect-value">{{ describeReward(e) }}</span>
          </li>
        </ul>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { useRewards } from '@/composables/useRewards'

const { rewardsList: rewards, describeReward } = useRewards()
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.rewards {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.rewards-header h2 {
  @include section-label;
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.02em;
  opacity: 0.85;
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
  gap: 0.3rem;
}
.card {
  @include panel-card;
  padding: 0.45rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
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
.hint {
  @include hint-text;
  margin: 0;
  padding-left: 1.75rem;
  font-size: 0.75rem;
}
.effects {
  list-style: none;
  margin: 0;
  padding: 0 0 0 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}
.effect-row {
  font-size: 0.8rem;
}
.effect-value {
  @include tabular;
  font-weight: 600;
  color: var(--palm-leaf);
}
</style>
