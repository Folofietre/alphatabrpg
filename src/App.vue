<template>
  <CharacterSetup v-if="!hasCharacter" />
  <main v-else class="app">
    <header>
      <SettingsMenu />
      <h1>AlphaTab RPG</h1>
      <div class="spacer" />
    </header>
    <div class="body">
      <aside class="left">
        <PlaylistColumn />
      </aside>
      <div class="main">
        <CharacterStats />
        <ScorePlayer />
      </div>
      <aside class="right">
        <CustomScore />
        <TabLibrary />
      </aside>
    </div>
  </main>
</template>

<script setup>
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import CharacterStats from '@/components/CharacterStats.vue'
import ScorePlayer from '@/components/ScorePlayer.vue'
import SettingsMenu from '@/components/SettingsMenu.vue'
import TabLibrary from '@/components/TabLibrary.vue'
import CustomScore from '@/components/CustomScore.vue'
import CharacterSetup from '@/components/CharacterSetup.vue'
import PlaylistColumn from '@/components/PlaylistColumn.vue'

const store = useCharacterStore()
store.load() // synchronous: read localStorage before first render to avoid flash

const hasCharacter = computed(() => !!store.character.instrument)
</script>

<style scoped>
.app {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  color: var(--text-h);
  letter-spacing: 0.02em;
}
.spacer {
  width: 38px;
}
.body {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 280px;
  gap: 1.25rem;
  align-items: start;
}
.main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}
.left,
.right {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}
@media (max-width: 1100px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
