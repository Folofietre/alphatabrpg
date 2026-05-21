<template>
  <div class="session-result">
    <h3>{{ result.completed ? 'Session complete' : 'Session interrupted' }}</h3>
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
        <span>Status</span>
        <strong>{{ result.completed ? 'Finished' : 'Gave up' }}</strong>
      </li>
    </ul>

    <h4>Gains</h4>
    <ul class="gains">
      <li>Speed <strong>+{{ format(result.xpGained.speed) }}</strong></li>
      <li>Dexterity <strong>+{{ format(result.xpGained.dexterity) }}</strong></li>
      <li>Endurance <strong>+{{ format(result.xpGained.endurance) }}</strong></li>
    </ul>

    <button class="replay" @click="$emit('replay')">Replay</button>
  </div>
</template>

<script setup>
defineProps({
  result: {
    type: Object,
    required: true,
  },
})
defineEmits(['replay'])

function format(v) {
  return (v * 100).toFixed(1) + '%'
}
</script>

<style scoped>
.session-result {
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  background: rgba(95, 168, 255, 0.08);
  border: 1px solid rgba(95, 168, 255, 0.25);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
}
.replay {
  align-self: flex-start;
  margin-top: 0.25rem;
}
</style>
