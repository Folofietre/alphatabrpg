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
      <label>{{ stat.label }}</label>
      <div class="bar">
        <div class="fill" :style="{ width: `${stat.ratio * 100}%` }" />
      </div>
      <span class="value">{{ stat.display }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { INSTRUMENT_META } from '@/utils/instruments'

const SPEED_CAP = 600
const ENDURANCE_CAP = 500

const store = useCharacterStore()
const instrumentMeta = computed(() => INSTRUMENT_META[store.character.instrument] ?? null)

const stats = computed(() => [
  {
    key: 'speed',
    label: 'Speed',
    ratio: Math.min(1, store.character.speed / SPEED_CAP),
    display: `${store.character.speed} opm`,
  },
  {
    key: 'dexterity',
    label: 'Dexterity',
    ratio: store.character.dexterity,
    display: `${Math.round(store.character.dexterity * 100)}%`,
  },
  {
    key: 'endurance',
    label: 'Endurance',
    ratio: Math.min(1, store.character.endurance / ENDURANCE_CAP),
    display: `${store.character.endurance} notes`,
  },
])
</script>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background: var(--panel);
  border: 1px solid var(--panel-border);
}
.stats h2 {
  margin: 0;
  font-size: 1.1rem;
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
  border-radius: none;
  object-fit: cover;
  background: var(--bg-surface);
  border: 1px solid var(--panel-border);
  user-select: none;
  -webkit-user-drag: none;
  flex-shrink: 0;
}
.role {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.stat {
  display: grid;
  grid-template-columns: 90px 1fr 80px;
  align-items: center;
  gap: 0.5rem;
}
.stat label {
  font-size: 0.9rem;
  opacity: 0.85;
}
.bar {
  height: 12px;
  background: var(--panel-strong);
  border-radius: 999px;
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, var(--muted-olive), var(--palm-leaf));
  transition: width 0.4s ease;
}
.value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  opacity: 0.85;
}
</style>
