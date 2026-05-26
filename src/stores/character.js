import { defineStore } from 'pinia'
import { SUPPORTED_INSTRUMENTS } from '@/utils/instruments'
import {
  FAMILIARITY_CAP,
  DC_BASE,
  compositeScore,
} from '@/utils/rpgEngine'

const SAVE_KEY = 'alphatab_rpg_save_v7'
// Older save versions from earlier prototypes. We wipe them on load — no
// migration during development, schema changes force a fresh character.
const LEGACY_KEYS = [
  'alphatab_rpg_save_v6',
  'alphatab_rpg_save_v5',
  'alphatab_rpg_save_v4',
  'alphatab_rpg_save_v3',
  'alphatab_rpg_save_v2',
  'alphatab_rpg_save',
]

// All three stats are now uncapped integers. Floors stop penalties from
// dropping a player below their starting position; there is no upper bound.
const SPEED_FLOOR = 30
const DEX_FLOOR = 50          // also the minimum random starter
const DEX_ROLL_MAX = 100      // max random starter
const ENDURANCE_FLOOR = 30

const MIN_BEATS_FOR_OUTCOME = 10

function rollInitialDexterity() {
  return Math.floor(DEX_FLOOR + Math.random() * (DEX_ROLL_MAX - DEX_FLOOR + 1))
}

const defaultCharacter = () => ({
  name: 'Musician',
  instrument: '',           // empty until CharacterSetup completes
  speed: SPEED_FLOOR,
  dexterity: rollInitialDexterity(),
  endurance: ENDURANCE_FLOOR,
})

const emptyTabRecord = () => ({
  attemptsCount: 0,
  completionsCount: 0,
  firstCompletedAt: null,
  lastPlayedAt: null,
  bestAccuracy: null,
  bestPlaybackSpeed: null,
  bestScore: null,           // integer; bigger numbers on harder songs
  familiarity: 0,
  dc: null,                  // P95 beat DC, cached on first load
})

function gainsFor(outcome, accuracy) {
  // outcome: 'completed' | 'stopped' | 'exhausted'
  if (outcome === 'completed') {
    return {
      speed: 10,
      // Premium dex gain on clean runs (>70% accuracy), modest gain otherwise.
      dexterity: accuracy > 0.7 ? 10 : 4,
      endurance: 5,
    }
  }
  if (outcome === 'stopped') {
    return { speed: 1, dexterity: 1, endurance: -2 }
  }
  // exhausted
  return { speed: 0, dexterity: 0, endurance: -5 }
}

// Lower-bound only — stats are uncapped.
function floor(value, min) {
  return Math.max(min, value)
}

export const useCharacterStore = defineStore('character', {
  state: () => ({
    character: defaultCharacter(),
    history: [],
    notesPlayed: 0,
    tabRecords: {},
  }),

  getters: {
    accuracyThreshold: (s) => s.character.dexterity,
    stamina: (s) => Math.max(0, 1 - s.notesPlayed / Math.max(1, s.character.endurance)),
  },

  actions: {
    load() {
      // Wipe legacy keys unconditionally. We're still in development; schema
      // bumps reset the character rather than migrate.
      for (const key of LEGACY_KEYS) localStorage.removeItem(key)

      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return

      const saved = JSON.parse(raw)
      this.character = { ...defaultCharacter(), ...(saved.character ?? {}) }
      this.history = saved.history ?? []
      this.tabRecords = saved.tabRecords ?? {}
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
      this.tabRecords = {}
      this.save()
    },

    save() {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        character: this.character,
        history: this.history,
        tabRecords: this.tabRecords,
        savedAt: new Date().toISOString(),
      }))
    },

    resetStamina() {
      this.notesPlayed = 0
    },

    spendNotes(amount) {
      this.notesPlayed += amount
    },

    // Single source of truth for per-tab record updates. Bumps counts, tracks
    // best score on completion, caches the score DC, and grows familiarity
    // modulated by the player's skill vs. the song's DC.
    recordTabSession({ tabId, outcome, accuracy, playbackMultiplier, difficulty }) {
      if (!tabId) return null
      const existing = this.tabRecords[tabId] ?? emptyTabRecord()
      const now = new Date().toISOString()
      const next = {
        ...existing,
        attemptsCount: (existing.attemptsCount ?? 0) + 1,
        lastPlayedAt: now,
      }
      // Cache song DC the first time we know it.
      if (difficulty != null && existing.dc == null) {
        next.dc = difficulty
      }

      let scorePB = false
      if (outcome === 'completed') {
        next.completionsCount = (existing.completionsCount ?? 0) + 1
        if (!next.firstCompletedAt) next.firstCompletedAt = now

        // Score scales with DC so harder songs are worth more, even on
        // imperfect runs.
        const dcForScore = next.dc ?? difficulty ?? DC_BASE
        const score = compositeScore(accuracy, playbackMultiplier, dcForScore)
        if (next.bestScore == null || score > next.bestScore) {
          next.bestAccuracy = accuracy
          next.bestPlaybackSpeed = playbackMultiplier
          next.bestScore = score
          scorePB = true
        }
      }

      // Growth modulation: base delta × clamp(0.5, 1.5, skill / dc).
      // playerSkill and dc are in the same integer units now, so the ratio
      // is direct (no rescaling needed).
      const baseDelta = outcome === 'completed' ? 0.05 : 0.02
      const skill = ((this.character.dexterity ?? 0) + (this.character.speed ?? 0)) / 2
      const dc = Math.max(DC_BASE, next.dc ?? difficulty ?? DC_BASE)
      const ratio = skill / dc
      const growthMultiplier = Math.max(0.5, Math.min(1.5, ratio))
      const familiarityBefore = existing.familiarity ?? 0
      next.familiarity = Math.min(
        FAMILIARITY_CAP,
        familiarityBefore + baseDelta * growthMultiplier,
      )

      this.tabRecords = { ...this.tabRecords, [tabId]: next }

      return {
        familiarityBefore,
        familiarityAfter: next.familiarity,
        scoreBefore: existing.bestScore,
        scoreAfter: next.bestScore,
        scorePB,
      }
    },

    applySessionXP({
      tabId,
      title,
      accuracy,
      outcome,
      beatCount,
      bonusMultiplier = 1,
      playbackMultiplier = 1,
      difficulty = null,
    }) {
      // Sessions too short to count: no XP, no penalty, no record bump.
      if (beatCount < MIN_BEATS_FOR_OUTCOME) {
        this.history.unshift({
          tabId, title, accuracy, outcome, beatCount,
          date: new Date().toISOString(),
          xpGained: { speed: 0, dexterity: 0, endurance: 0 },
          tooShort: true,
        })
        if (this.history.length > 20) this.history.pop()
        this.save()
        return {
          speed: 0, dexterity: 0, endurance: 0,
          tooShort: true,
          recordDelta: null,
        }
      }

      const base = gainsFor(outcome, accuracy)
      // Multiplier only boosts positive gains; penalties stay raw.
      const xpGained = {
        speed:     base.speed     > 0 ? base.speed     * bonusMultiplier : base.speed,
        dexterity: base.dexterity > 0 ? base.dexterity * bonusMultiplier : base.dexterity,
        endurance: base.endurance > 0 ? base.endurance * bonusMultiplier : base.endurance,
      }
      const before = { ...this.character }

      // Uncapped: floor only.
      this.character.speed     = floor(this.character.speed     + xpGained.speed,     SPEED_FLOOR)
      this.character.dexterity = floor(this.character.dexterity + xpGained.dexterity, DEX_FLOOR)
      this.character.endurance = floor(this.character.endurance + xpGained.endurance, ENDURANCE_FLOOR)

      const actual = {
        speed: this.character.speed - before.speed,
        dexterity: this.character.dexterity - before.dexterity,
        endurance: this.character.endurance - before.endurance,
      }

      const recordDelta = this.recordTabSession({
        tabId, outcome, accuracy, playbackMultiplier, difficulty,
      })

      this.history.unshift({
        tabId, title, accuracy, outcome, beatCount,
        date: new Date().toISOString(),
        xpGained: actual,
        bonusMultiplier: bonusMultiplier !== 1 ? bonusMultiplier : undefined,
      })
      if (this.history.length > 20) this.history.pop()

      this.save()
      return { ...actual, recordDelta }
    },

    reset() {
      this.character = defaultCharacter()
      this.history = []
      this.notesPlayed = 0
      this.tabRecords = {}
      localStorage.removeItem(SAVE_KEY)
    },
  },
})
