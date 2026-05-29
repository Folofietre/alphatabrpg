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
        <!-- TODO: re-introduce <CustomScore /> as an end-game reward, unlocked
             once every built-in score is completed. Keeping the component file
             and its file-drop plumbing alive but unmounted. -->
        <nav class="right-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </nav>
        <TabLibrary v-if="activeTab === 'scores'" />
        <RewardsList v-else-if="activeTab === 'rewards'" />
      </aside>
    </div>
    <footer>
      <LegalFooter />
    </footer>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useCharacterStore } from '@/stores/character'
import CharacterStats from '@/components/CharacterStats.vue'
import ScorePlayer from '@/components/ScorePlayer.vue'
import SettingsMenu from '@/components/SettingsMenu.vue'
import TabLibrary from '@/components/TabLibrary.vue'
import RewardsList from '@/components/RewardsList.vue'
// TODO: re-enable when Custom Score is unlocked as an end-game reward.
// import CustomScore from '@/components/CustomScore.vue'
import CharacterSetup from '@/components/CharacterSetup.vue'
import PlaylistColumn from '@/components/PlaylistColumn.vue'
import LegalFooter from '@/components/LegalFooter.vue'

const store = useCharacterStore()
store.load() // synchronous: read localStorage before first render to avoid flash

const hasCharacter = computed(() => !!store.character.instrument)

const tabs = [
  { id: 'scores', label: 'Scores' },
  { id: 'rewards', label: 'Bonus' },
]
const activeTab = ref('scores')
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.app {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: $gap-lg;
}
header {
  display: grid;
  grid-template-columns: 38px 1fr 38px;
  align-items: center;
  gap: $gap-md;

  h1 {
    margin: 0;
    font-size: 1.6rem;
    text-align: center;
    color: var(--text-h);
    letter-spacing: 0.02em;
  }
}
.spacer {
  width: 38px;
}
.body {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 280px;
  gap: $gap-xl;
  align-items: start;
}
.main,
.left,
.right {
  display: flex;
  flex-direction: column;
  gap: $gap-xl;
  min-width: 0;
}
.right-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--panel-border);
  margin-bottom: -1px;

  button {
    flex: 1;
    @include button-base;
    padding: 0.45rem 0.6rem;
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    border-top-left-radius: $radius-sm;
    border-top-right-radius: $radius-sm;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition:
      color $transition-fast,
      background-color $transition-fast,
      border-color $transition-fast;

    &:hover { color: var(--text); }
    &.active {
      background: var(--panel);
      border-color: var(--panel-border);
      border-bottom-color: var(--panel);
      color: var(--accent);
    }
  }
}
@media (max-width: 1100px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
