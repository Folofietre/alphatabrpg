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

// All three stats are uncapped integers with a *dynamic* floor: every 50
// points crossed becomes a new milestone, and the floor ratchets up to the
// highest milestone the player has ever reached. Losing XP can never bring
// a stat back below a passed milestone.
const SPEED_FLOOR = 30
const DEX_FLOOR = 50          // also the minimum random starter
const DEX_ROLL_MAX = 100      // max random starter
const ENDURANCE_FLOOR = 30
export const MILESTONE_STEP = 50

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

const defaultFloors = () => ({
  speed: SPEED_FLOOR,
  dexterity: DEX_FLOOR,
  endurance: ENDURANCE_FLOOR,
})

// Compute the next floor for a stat: the higher of its current floor and the
// largest 50-multiple ≤ the new value. Floors only ratchet up — never down.
function nextFloor(currentFloor, newValue) {
  const milestone = Math.floor(newValue / MILESTONE_STEP) * MILESTONE_STEP
  return Math.max(currentFloor, milestone)
}

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
  onsetRate: null,           // P95 onset rate (used to derive comfort speed)
})

// Extra Speed XP awarded when a player completes a song *above* their comfort
// speed. Stacks with the streak multiplier the same way base XP does.
const STRETCH_SPEED_BONUS = 5

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

// Apply a delta to a stat, ratcheting the floor up if the new value crosses
// a 50-point milestone. Returns the clamped value and the (possibly new)
// floor for that stat.
function stepStat(currentValue, currentFloor, delta) {
  const raw = currentValue + delta
  const floorAfter = nextFloor(currentFloor, raw)
  return {
    value: Math.max(floorAfter, raw),
    floor: floorAfter,
  }
}

export const useCharacterStore = defineStore('character', {
  state: () => ({
    character: defaultCharacter(),
    floors: defaultFloors(),
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
      // Restore floors, or derive from current stats for older saves.
      const savedFloors = saved.floors ?? null
      this.floors = savedFloors
        ? { ...defaultFloors(), ...savedFloors }
        : {
            speed: nextFloor(SPEED_FLOOR, this.character.speed),
            dexterity: nextFloor(DEX_FLOOR, this.character.dexterity),
            endurance: nextFloor(ENDURANCE_FLOOR, this.character.endurance),
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
      // Initial dex roll (50..100) may already sit above the 50-milestone.
      // Compute starting floors accordingly so a 100-rolled player can't drop
      // below 100, etc.
      this.floors = {
        speed: nextFloor(SPEED_FLOOR, this.character.speed),
        dexterity: nextFloor(DEX_FLOOR, this.character.dexterity),
        endurance: nextFloor(ENDURANCE_FLOOR, this.character.endurance),
      }
      this.notesPlayed = 0
      this.history = []
      this.tabRecords = {}
      this.save()
    },

    save() {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        character: this.character,
        floors: this.floors,
        history: this.history,
        tabRecords: this.tabRecords,
        savedAt: new Date().toISOString(),
      }))
    },

    resetStamina() {
      this.notesPlayed = 0
    },

    // Cache the score's onset rate on first load so the next time this tab is
    // queued the playlist seeds the speed slider to the player's comfort speed
    // instead of 100%. No-op when already cached or when tabId is missing.
    cacheTabOnsetRate(tabId, onsetRate) {
      if (!tabId || onsetRate == null) return
      const existing = this.tabRecords[tabId] ?? emptyTabRecord()
      if (existing.onsetRate != null) return
      this.tabRecords = {
        ...this.tabRecords,
        [tabId]: { ...existing, onsetRate },
      }
      this.save()
    },

    spendNotes(amount) {
      this.notesPlayed += amount
    },

    // Single source of truth for per-tab record updates. Bumps counts, tracks
    // best score on completion, caches the score DC, and grows familiarity
    // modulated by the player's skill vs. the song's DC.
    recordTabSession({ tabId, outcome, accuracy, playbackMultiplier, difficulty, onsetRate }) {
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
      // Cache onset rate the first time we know it (used to derive comfort).
      if (onsetRate != null && existing.onsetRate == null) {
        next.onsetRate = onsetRate
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
      onsetRate = null,
      aboveComfort = false,
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
      // Reward stretching: a +5 Speed bonus when the player completes a song
      // above their comfort speed. Stacks with the streak multiplier.
      const stretchSpeed = outcome === 'completed' && aboveComfort ? STRETCH_SPEED_BONUS : 0
      const baseSpeed = base.speed + stretchSpeed
      // Multiplier only boosts positive gains; penalties stay raw.
      const xpGained = {
        speed:     baseSpeed      > 0 ? baseSpeed      * bonusMultiplier : baseSpeed,
        dexterity: base.dexterity > 0 ? base.dexterity * bonusMultiplier : base.dexterity,
        endurance: base.endurance > 0 ? base.endurance * bonusMultiplier : base.endurance,
        stretchSpeed,
      }
      const before = { ...this.character }

      // Step each stat with a ratcheting floor: crossing a 50-point milestone
      // raises the floor permanently for that stat.
      const sp = stepStat(this.character.speed,     this.floors.speed,     xpGained.speed)
      const dx = stepStat(this.character.dexterity, this.floors.dexterity, xpGained.dexterity)
      const en = stepStat(this.character.endurance, this.floors.endurance, xpGained.endurance)

      this.character.speed     = sp.value
      this.character.dexterity = dx.value
      this.character.endurance = en.value
      this.floors = { speed: sp.floor, dexterity: dx.floor, endurance: en.floor }

      const actual = {
        speed: this.character.speed - before.speed,
        dexterity: this.character.dexterity - before.dexterity,
        endurance: this.character.endurance - before.endurance,
      }

      const recordDelta = this.recordTabSession({
        tabId, outcome, accuracy, playbackMultiplier, difficulty, onsetRate,
      })

      this.history.unshift({
        tabId, title, accuracy, outcome, beatCount,
        date: new Date().toISOString(),
        xpGained: actual,
        bonusMultiplier: bonusMultiplier !== 1 ? bonusMultiplier : undefined,
      })
      if (this.history.length > 20) this.history.pop()

      this.save()
      return { ...actual, stretchSpeed, recordDelta }
    },

    reset() {
      this.character = defaultCharacter()
      this.floors = defaultFloors()
      this.history = []
      this.notesPlayed = 0
      this.tabRecords = {}
      localStorage.removeItem(SAVE_KEY)
    },
  },
})
