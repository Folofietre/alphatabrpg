<template>
  <main class="app">
    <header>
      <SettingsMenu />
      <h1>AlphaTab RPG</h1>
      <div class="spacer" />
    </header>
    <div class="body">
      <div class="main">
        <CharacterStats />
        <ScorePlayer />
      </div>
      <TabLibrary />
    </div>
  </main>
</template>

<script setup>
import { onMounted } from 'vue'
import { useCharacterStore } from '@/stores/character'
import CharacterStats from '@/components/CharacterStats.vue'
import ScorePlayer from '@/components/ScorePlayer.vue'
import SettingsMenu from '@/components/SettingsMenu.vue'
import TabLibrary from '@/components/TabLibrary.vue'

const store = useCharacterStore()
onMounted(() => store.load())
</script>

<style scoped>
.app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
header {
  display: grid;
  grid-template-columns: 38px 1fr 38px;
  align-items: center;
  gap: 0.75rem;
}
header h1 {
  margin: 0;
  font-size: 1.6rem;
  text-align: center;
}
.spacer {
  width: 38px;
}
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 1.25rem;
  align-items: start;
}
.main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}
@media (max-width: 880px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
