import { defineStore } from 'pinia'
import { SUPPORTED_INSTRUMENTS } from '@/utils/instruments'

const SAVE_KEY = 'alphatab_rpg_save_v4'
const LEGACY_KEYS = ['alphatab_rpg_save_v3', 'alphatab_rpg_save_v2', 'alphatab_rpg_save']

const SPEED_CAP = 600
const ENDURANCE_CAP = 500

const SPEED_FLOOR = 30
const DEX_FLOOR = 0.20
const ENDURANCE_FLOOR = 30

const MIN_BEATS_FOR_OUTCOME = 10

const defaultCharacter = () => ({
  name: 'Musician',
  instrument: '',           // empty until CharacterSetup completes
  speed: SPEED_FLOOR,
  dexterity: DEX_FLOOR,
  endurance: ENDURANCE_FLOOR,
})

function gainsFor(outcome, accuracy) {
  // outcome: 'completed' | 'stopped' | 'exhausted'
  if (outcome === 'completed') {
    return {
      speed: 10,
      dexterity: accuracy > 0.7 ? 0.020 : 0.008,
      endurance: 5,
    }
  }
  if (outcome === 'stopped') {
    return { speed: 1, dexterity: 0.005, endurance: -2 }
  }
  // exhausted
  return { speed: 0, dexterity: 0, endurance: -5 }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export const useCharacterStore = defineStore('character', {
  state: () => ({
    character: defaultCharacter(),
    history: [],
    notesPlayed: 0,
  }),

  getters: {
    accuracyThreshold: (s) => s.character.dexterity,
    stamina: (s) => Math.max(0, 1 - s.notesPlayed / Math.max(1, s.character.endurance)),
  },

  actions: {
    load() {
      let raw = localStorage.getItem(SAVE_KEY)
      let migrated = false
      if (!raw) {
        // Migrate from the most recent legacy key, if any.
        for (const key of LEGACY_KEYS) {
          const legacy = localStorage.getItem(key)
          if (legacy) {
            raw = legacy
            migrated = true
            break
          }
        }
      }
      if (!raw) return

      const saved = JSON.parse(raw)
      this.character = { ...defaultCharacter(), ...(saved.character ?? {}) }
      this.history = saved.history ?? []

      // Migrated saves never had an instrument — they default to piano,
      // the most permissive class, so the existing player isn't locked out.
      if (migrated && !this.character.instrument) {
        this.character.instrument = 'piano'
      }
      if (migrated) {
        this.save()
        for (const key of LEGACY_KEYS) localStorage.removeItem(key)
      }
    },

    createCharacter({ name, instrument }) {
      if (this.character.instrument) return // already created; locked.
      if (!SUPPORTED_INSTRUMENTS.includes(instrument)) return
      this.character = {
        ...defaultCharacter(),
        name: (name ?? '').trim() || 'Musician',
        instrument,
      }
      this.notesPlayed = 0
      this.history = []
      this.save()
    },

    save() {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        character: this.character,
        history: this.history,
        savedAt: new Date().toISOString(),
      }))
    },

    resetStamina() {
      this.notesPlayed = 0
    },

    spendNotes(amount) {
      this.notesPlayed += amount
    },

    applySessionXP({ title, accuracy, outcome, beatCount }) {
      // Sessions too short to count: no XP, no penalty (player barely tried).
      if (beatCount < MIN_BEATS_FOR_OUTCOME) {
        this.history.unshift({
          title, accuracy, outcome, beatCount,
          date: new Date().toISOString(),
          xpGained: { speed: 0, dexterity: 0, endurance: 0 },
          tooShort: true,
        })
        if (this.history.length > 20) this.history.pop()
        this.save()
        return { speed: 0, dexterity: 0, endurance: 0, tooShort: true }
      }

      const xpGained = gainsFor(outcome, accuracy)
      const before = { ...this.character }

      this.character.speed     = clamp(this.character.speed     + xpGained.speed,     SPEED_FLOOR, SPEED_CAP)
      this.character.dexterity = clamp(this.character.dexterity + xpGained.dexterity, DEX_FLOOR,   1.0)
      this.character.endurance = clamp(this.character.endurance + xpGained.endurance, ENDURANCE_FLOOR, ENDURANCE_CAP)

      // Actual deltas after clamping (may be smaller than nominal if hitting a floor/cap).
      const actual = {
        speed: this.character.speed - before.speed,
        dexterity: this.character.dexterity - before.dexterity,
        endurance: this.character.endurance - before.endurance,
      }

      this.history.unshift({
        title, accuracy, outcome, beatCount,
        date: new Date().toISOString(),
        xpGained: actual,
      })
      if (this.history.length > 20) this.history.pop()

      this.save()
      return actual
    },

    reset() {
      this.character = defaultCharacter()
      this.history = []
      this.notesPlayed = 0
      localStorage.removeItem(SAVE_KEY)
    },
  },
})
