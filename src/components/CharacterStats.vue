<template>
  <section class="stats">
    <h2>{{ store.character.name }}</h2>
    <div v-for="stat in stats" :key="stat.key" class="stat">
      <label>{{ stat.label }}</label>
      <div class="bar">
        <div class="fill" :style="{ width: `${stat.value * 100}%` }" />
      </div>
      <span class="value">{{ Math.round(stat.value * 100) }}%</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'

const store = useCharacterStore()

const stats = computed(() => [
  { key: 'speed', label: 'Speed', value: store.character.speed },
  { key: 'dexterity', label: 'Dexterity', value: store.character.dexterity },
  { key: 'endurance', label: 'Endurance', value: store.character.endurance },
])
</script>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.04);
}
.stats h2 {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
}
.stat {
  display: grid;
  grid-template-columns: 90px 1fr 48px;
  align-items: center;
  gap: 0.5rem;
}
.stat label {
  font-size: 0.9rem;
  opacity: 0.85;
}
.bar {
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, #5fa8ff, #a06bff);
  transition: width 0.4s ease;
}
.value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  opacity: 0.85;
}
</style>
