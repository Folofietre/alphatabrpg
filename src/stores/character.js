import { defineStore } from 'pinia'

const SAVE_KEY = 'alphatab_rpg_save'

const defaultCharacter = () => ({
  name: 'Musician',
  speed: 0.35,
  dexterity: 0.20,
  endurance: 0.40,
})

export const useCharacterStore = defineStore('character', {
  state: () => ({
    character: defaultCharacter(),
    history: [],
    fatigue: 1.0,
  }),

  getters: {
    playbackSpeed: (s) => Math.min(s.character.speed, 1.0),
    accuracyThreshold: (s) => s.character.dexterity,
    maxFatigue: (s) => s.character.endurance,
  },

  actions: {
    load() {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        this.character = saved.character ?? defaultCharacter()
        this.history = saved.history ?? []
      }
    },

    save() {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        character: this.character,
        history: this.history,
        savedAt: new Date().toISOString(),
      }))
    },

    resetFatigue() {
      this.fatigue = 1.0
    },

    drainFatigue(amount) {
      this.fatigue = Math.max(0, this.fatigue - amount)
    },

    applySessionXP({ title, accuracy, completed, beatCount }) {
      const xpGained = {
        speed:     completed ? 0.015 : 0.005,
        dexterity: accuracy > 0.7 ? 0.020 : 0.008,
        endurance: completed ? 0.012 : 0.004,
      }
      this.character.speed     = Math.min(1.0, this.character.speed     + xpGained.speed)
      this.character.dexterity = Math.min(1.0, this.character.dexterity + xpGained.dexterity)
      this.character.endurance = Math.min(1.0, this.character.endurance + xpGained.endurance)

      this.history.unshift({
        title, accuracy, completed,
        date: new Date().toISOString(),
        xpGained,
      })
      if (this.history.length > 20) this.history.pop()

      this.save()
    },

    reset() {
      this.character = defaultCharacter()
      this.history = []
      this.fatigue = 1.0
      localStorage.removeItem(SAVE_KEY)
    },
  },
})
