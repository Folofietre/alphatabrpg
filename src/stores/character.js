import { defineStore } from 'pinia'
import { SUPPORTED_INSTRUMENTS } from '@/utils/instruments'
import {
  FAMILIARITY_CAP,
  compositeScore,
  starTier,
} from '@/utils/rpgEngine'

const SAVE_KEY = 'alphatab_rpg_save_v6'
// Older save versions from earlier prototypes. We wipe them on load — no
// migration during development, schema changes force a fresh character.
const LEGACY_KEYS = [
  'alphatab_rpg_save_v5',
  'alphatab_rpg_save_v4',
  'alphatab_rpg_save_v3',
  'alphatab_rpg_save_v2',
  'alphatab_rpg_save',
]

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

const emptyTabRecord = () => ({
  attemptsCount: 0,
  completionsCount: 0,
  firstCompletedAt: null,
  lastPlayedAt: null,
  bestAccuracy: null,
  bestPlaybackSpeed: null,
  bestScore: null,
  bestStars: null,
  familiarity: 0,
  estimatedDifficulty: null,
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
    // tabId → { attemptsCount, completionsCount, firstCompletedAt, lastPlayedAt,
    //          bestAccuracy, bestPlaybackSpeed, bestScore, bestStars,
    //          familiarity, estimatedDifficulty }
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
    // best score on completion, caches estimatedDifficulty, and grows
    // familiarity modulated by the player's skill vs. song difficulty.
    // Returns a delta object describing what changed (for SessionResult UI).
    recordTabSession({ tabId, outcome, accuracy, playbackMultiplier, difficulty }) {
      if (!tabId) return null
      const existing = this.tabRecords[tabId] ?? emptyTabRecord()
      const now = new Date().toISOString()
      const next = {
        ...existing,
        attemptsCount: (existing.attemptsCount ?? 0) + 1,
        lastPlayedAt: now,
      }
      // Cache difficulty the first time we know it.
      if (difficulty != null && existing.estimatedDifficulty == null) {
        next.estimatedDifficulty = difficulty
      }

      let scorePB = false
      if (outcome === 'completed') {
        next.completionsCount = (existing.completionsCount ?? 0) + 1
        if (!next.firstCompletedAt) next.firstCompletedAt = now

        const score = compositeScore(accuracy, playbackMultiplier)
        if (next.bestScore == null || score > next.bestScore) {
          next.bestAccuracy = accuracy
          next.bestPlaybackSpeed = playbackMultiplier
          next.bestScore = score
          next.bestStars = starTier(score)
          scorePB = true
        }
      }

      // Growth modulation: base delta × clamp(0.5, 1.5, skill / difficulty).
      const baseDelta = outcome === 'completed' ? 0.05 : 0.02
      const normalizedSpeed = (this.character.speed ?? SPEED_FLOOR) / SPEED_CAP
      const skill = ((this.character.dexterity ?? 0) + normalizedSpeed) / 2
      const diff = Math.max(0.15, next.estimatedDifficulty ?? difficulty ?? 0.5)
      const ratio = skill / diff
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
        starsBefore: existing.bestStars,
        starsAfter: next.bestStars,
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

      this.character.speed     = clamp(this.character.speed     + xpGained.speed,     SPEED_FLOOR, SPEED_CAP)
      this.character.dexterity = clamp(this.character.dexterity + xpGained.dexterity, DEX_FLOOR,   1.0)
      this.character.endurance = clamp(this.character.endurance + xpGained.endurance, ENDURANCE_FLOOR, ENDURANCE_CAP)

      const actual = {
        speed: this.character.speed - before.speed,
        dexterity: this.character.dexterity - before.dexterity,
        endurance: this.character.endurance - before.endurance,
      }

      // Update the per-tab record (best score, completion count, familiarity).
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
