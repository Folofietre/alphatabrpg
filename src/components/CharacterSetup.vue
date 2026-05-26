<template>
  <div class="setup-overlay">
    <form class="setup-card" @submit.prevent="onSubmit">
      <h1>Create your musician</h1>
      <p class="lead">
        Pick a name and an instrument. <strong>The instrument is permanent</strong>
        — changing it will come later as a Prestige reward.
      </p>

      <label class="field">
        <span class="field-label">Name</span>
        <input
          v-model="name"
          type="text"
          maxlength="32"
          placeholder="Musician"
          required
        />
      </label>

      <fieldset class="instruments">
        <legend>Instrument</legend>
        <div class="grid">
          <button
            v-for="key in keys"
            :key="key"
            type="button"
            class="card"
            :class="{ active: instrument === key, disabled: meta[key].disabled }"
            :disabled="meta[key].disabled"
            @click="pick(key)"
          >
            <span class="symbol">{{ meta[key].symbol }}</span>
            <span class="label">{{ meta[key].label }}</span>
            <span class="tagline">{{ meta[key].tagline }}</span>
            <img
              v-if="meta[key].avatar"
              :src="meta[key].avatar"
              :alt="`${meta[key].label} portrait`"
              class="avatar"
              draggable="false"
            />
          </button>
        </div>
      </fieldset>

      <button type="submit" class="submit" :disabled="!instrument">
        Start playing
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { PICKER_INSTRUMENTS, INSTRUMENT_META } from '@/utils/instruments'

const store = useCharacterStore()
const name = ref('')
const instrument = ref('')
const keys = PICKER_INSTRUMENTS
const meta = INSTRUMENT_META

function pick(key) {
  if (meta[key]?.disabled) return
  instrument.value = key
}

function onSubmit() {
  if (!instrument.value) return
  if (meta[instrument.value]?.disabled) return
  store.createCharacter({ name: name.value, instrument: instrument.value })
}
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as *;

.setup-overlay {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: var(--bg);
}
.setup-card {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: $gap-xl;
  padding: 2rem;
  background: var(--bg-elevated);
  border: 1px solid var(--panel-border);
  border-radius: $radius-lg;
  box-shadow: var(--shadow);
}
h1 {
  margin: 0;
  font-size: 1.75rem;
}
.lead {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.85;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  input {
    padding: 0.6rem 0.75rem;
    font: inherit;
    color: var(--text);
    background: var(--bg-surface);
    border: 1px solid var(--panel-border);
    border-radius: $radius-md;
    outline: none;
    transition: border-color $transition-fast;

    &:focus { border-color: var(--accent); }
  }
}
.field-label {
  @include section-label;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  opacity: 0.8;
}
.instruments {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: $gap-sm;

  legend {
    @include section-label;
    font-size: 0.85rem;
    letter-spacing: 0.05em;
    opacity: 0.8;
    padding: 0;
    margin-bottom: 0.25rem;
  }
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: $gap-md;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 1rem;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 0.6rem;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  font: inherit;
  position: relative;
  transition:
    border-color $transition-fast,
    background-color $transition-fast,
    color $transition-fast;

  &:hover:not(.disabled) {
    border-color: var(--accent-border);
    background: var(--accent-bg);
  }
  &.active {
    border-color: var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
  }
  &.disabled {
    cursor: not-allowed;
    opacity: 0.55;

    .tagline {
      color: var(--faded-copper);
      opacity: 1;
      font-style: italic;
    }
  }
}
.symbol {
  font-size: 2.5rem;
  line-height: 1;
}
.label {
  font-weight: 600;
  font-size: 1rem;
}
.tagline {
  font-size: 0.8rem;
  opacity: 0.8;
  line-height: 1.3;
}
.avatar {
  margin-top: $gap-sm;
  align-self: center;
  width: 100%;
  max-width: 160px;
  aspect-ratio: 1;
  object-fit: contain;
  border-radius: $radius-md;
  background: none;
  user-select: none;
  -webkit-user-drag: none;
}
.submit {
  align-self: flex-end;
  padding: 0.65rem 1.4rem;
  background: var(--palm-leaf);
  color: var(--vanilla-cream);
  border: 1px solid var(--palm-leaf);
  border-radius: $radius-md;
  cursor: pointer;
  font-weight: 600;
  transition:
    background-color $transition-fast,
    border-color $transition-fast,
    opacity $transition-fast;

  &:hover:not(:disabled) {
    background: var(--ash-brown);
    border-color: var(--ash-brown);
    color: var(--vanilla-cream);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
