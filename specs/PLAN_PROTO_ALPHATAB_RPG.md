# Plan de développement — Proto AlphaTab RPG

> **Destinataire** : Claude Code (Cursor)
> **Objectif** : Construire un prototype jouable d'un jeu incrémental musical basé sur alphaTab.
> **Règle d'or** : Aucun backend. Tout dans le navigateur. Sauvegarde localStorage uniquement.
> **Ne pas demander de confirmation** avant chaque étape — exécuter dans l'ordre.

---

## Contexte métier (à lire avant de coder)

Le joueur incarne un musicien débutant avec des stats à 0. Il importe une partition (`.gp`, `.gpx`, `.xml`…). alphaTab la lit et la joue. Les stats du personnage modifient la lecture en temps réel :

- **Vitesse** → coefficient `playbackSpeed` (0.3 au départ, 1.0 = tempo réel)
- **Dextérité** → probabilité de "rater" une note (erreur audio uniquement, la partition affichée reste correcte)
- **Endurance** → jauge de fatigue qui se vide ; quand elle atteint 0, la lecture s'arrête

À la fin de chaque partition (`playerFinished`), les stats montent et la progression est sauvegardée en localStorage.

---

## Stack technique — décisions finales

| Élément | Choix | Raison |
|---|---|---|
| Framework UI | Vue 3 (Composition API) | Réactivité déclarative pour jauges temps réel |
| Build tool | Vite | Plugin officiel alphaTab disponible |
| State management | Pinia | Léger, natif Vue 3 |
| Audio/partition | `@coderline/alphatab` | Lib principale |
| Intégration Vite | `@coderline/alphatab-vite` | Gère workers, worklets, assets automatiquement |
| SoundFont | SONiVOX (inclus dans alphaTab) | Zéro config |
| Persistance | `localStorage` | Pas de backend |
| CSS | CSS Variables natives + scoped | Pas de Tailwind pour garder le proto simple |

---

## Étape 0 — Initialisation du projet

```bash
npm create vite@latest alphatab-rpg -- --template vue
cd alphatab-rpg
npm install @coderline/alphatab @coderline/alphatab-vite pinia
```

### `vite.config.js` — à remplacer entièrement

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { alphaTab } from '@coderline/alphatab-vite'

export default defineConfig({
  plugins: [vue(), alphaTab()]
})
```

---

## Étape 1 — Structure de fichiers cible

Créer exactement cette arborescence (ne pas créer d'autres fichiers à ce stade) :

```
src/
├── main.js
├── App.vue
├── stores/
│   └── character.js        # Pinia store — stats + historique
├── composables/
│   └── useAlphaTab.js      # Logique alphaTab isolée
├── components/
│   ├── ScorePlayer.vue     # Conteneur alphaTab + curseur
│   ├── CharacterStats.vue  # Jauges vitesse/dextérité/endurance
│   ├── FileDropzone.vue    # Import drag & drop de partition
│   └── SessionResult.vue   # Écran de fin de partition
└── utils/
    └── rpgEngine.js        # Calculs purs : difficulté, XP, jets de dés
```

---

## Étape 2 — Store Pinia (`stores/character.js`)

Implémenter ce store **exactement** avec ce schéma de données. C'est la source de vérité pour la sauvegarde.

```js
import { defineStore } from 'pinia'

const SAVE_KEY = 'alphatab_rpg_save'

const defaultCharacter = () => ({
  name: 'Musicien',
  speed: 0.35,       // playbackSpeed : 0.0 → 1.0
  dexterity: 0.20,   // probabilité de succès sur une note : 0.0 → 1.0
  endurance: 0.40,   // jauge max de fatigue : 0.0 → 1.0
})

export const useCharacterStore = defineStore('character', {
  state: () => ({
    character: defaultCharacter(),
    history: [],          // [{ title, date, accuracy, completed, xpGained }]
    fatigue: 1.0,         // jauge courante, réinitialisée à chaque partition
  }),

  getters: {
    playbackSpeed: (s) => Math.min(s.character.speed, 1.0),
    accuracyThreshold: (s) => s.character.dexterity,  // seuil pour les jets de dé
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

    // Appelé après chaque partition terminée
    applySessionXP({ title, accuracy, completed, beatCount }) {
      const xpGained = {
        speed:      completed ? 0.015 : 0.005,
        dexterity:  accuracy > 0.7 ? 0.020 : 0.008,
        endurance:  completed ? 0.012 : 0.004,
      }
      this.character.speed      = Math.min(1.0, this.character.speed      + xpGained.speed)
      this.character.dexterity  = Math.min(1.0, this.character.dexterity  + xpGained.dexterity)
      this.character.endurance  = Math.min(1.0, this.character.endurance  + xpGained.endurance)

      this.history.unshift({
        title, accuracy, completed,
        date: new Date().toISOString(),
        xpGained,
      })
      if (this.history.length > 20) this.history.pop()

      this.save() // ← sauvegarde automatique ici uniquement
    },

    reset() {
      this.character = defaultCharacter()
      this.history = []
      this.fatigue = 1.0
      localStorage.removeItem(SAVE_KEY)
    }
  }
})
```

---

## Étape 3 — Moteur RPG pur (`utils/rpgEngine.js`)

Fonctions pures, sans état, sans référence à Vue/Pinia. Testables unitairement.

```js
/**
 * Calcule si le personnage réussit à jouer une note.
 * @param {number} dexterity  - stat du personnage (0–1)
 * @param {object} note       - objet note alphaTab (note.value, note.fret…)
 * @param {number} prevPitch  - hauteur de la note précédente (MIDI)
 * @returns {{ success: boolean, semitones: number }}
 */
export function rollNoteAccuracy(dexterity, note, prevPitch = 60) {
  const pitch = note.realValue ?? note.value ?? 60
  const interval = Math.abs(pitch - prevPitch)

  // Difficulté augmente avec l'intervalle et les subdivisions rapides
  const difficulty = Math.min(1.0, interval / 12 + (note.duration?.value > 8 ? 0.2 : 0))
  const threshold = dexterity - difficulty * 0.4

  const roll = Math.random()
  const success = roll < threshold

  // En cas d'échec : déviation aléatoire de ±1 à ±3 demi-tons
  const semitones = success ? 0 : (Math.random() > 0.5 ? 1 : -1) * Math.ceil(Math.random() * 3)

  return { success, semitones }
}

/**
 * Quantité de fatigue dépensée par beat.
 * Dépend du tempo et de la densité rythmique.
 * @param {number} endurance  - stat du personnage (0–1)
 * @param {number} bpm        - tempo de la partition
 * @returns {number} fatigue dépensée (0.0–0.01 par beat)
 */
export function fatiguePerBeat(endurance, bpm = 120) {
  const baseCost = 0.003
  const tempoFactor = bpm / 120  // tempo rapide = plus fatiguant
  return baseCost * tempoFactor * (1 - endurance * 0.6)
}

/**
 * Analyse une partition alphaTab pour estimer sa difficulté.
 * @param {object} score - api.score d'alphaTab
 * @returns {{ estimatedDifficulty: number, noteCount: number, avgBpm: number }}
 */
export function analyzeScore(score) {
  if (!score) return { estimatedDifficulty: 0.5, noteCount: 0, avgBpm: 120 }

  const track = score.tracks?.[0]
  if (!track) return { estimatedDifficulty: 0.5, noteCount: 0, avgBpm: 120 }

  let noteCount = 0
  let maxInterval = 0
  let prevPitch = 60

  for (const staff of track.staves ?? []) {
    for (const bar of staff.bars ?? []) {
      for (const voice of bar.voices ?? []) {
        for (const beat of voice.beats ?? []) {
          for (const note of beat.notes ?? []) {
            const pitch = note.realValue ?? note.value ?? 60
            maxInterval = Math.max(maxInterval, Math.abs(pitch - prevPitch))
            prevPitch = pitch
            noteCount++
          }
        }
      }
    }
  }

  const avgBpm = score.tempo ?? 120
  const estimatedDifficulty = Math.min(1.0, (avgBpm / 200) * 0.4 + (maxInterval / 24) * 0.4 + (noteCount / 500) * 0.2)

  return { estimatedDifficulty, noteCount, avgBpm }
}
```

---

## Étape 4 — Composable alphaTab (`composables/useAlphaTab.js`)

Ce composable encapsule **toute** l'interaction avec `AlphaTabApi`. Les composants Vue ne touchent jamais à `api` directement.

```js
import { ref, onUnmounted } from 'vue'
import * as alphaTab from '@coderline/alphatab'
import { useCharacterStore } from '@/stores/character'
import { rollNoteAccuracy, fatiguePerBeat } from '@/utils/rpgEngine'

export function useAlphaTab(containerRef) {
  const store = useCharacterStore()
  const api = ref(null)
  const isReady = ref(false)
  const isPlaying = ref(false)
  const sessionStats = ref({ totalBeats: 0, successBeats: 0 })
  let prevPitch = 60

  function init() {
    if (!containerRef.value) return

    api.value = new alphaTab.AlphaTabApi(containerRef.value, {
      player: {
        enablePlayer: true,
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        soundFont: '/soundfont/sonivox.sf2',  // chemin géré par le plugin Vite
      },
      display: {
        layoutMode: alphaTab.LayoutMode.Page,
      },
    })

    // Partition chargée → appliquer la vitesse du personnage
    api.value.scoreLoaded.on(() => {
      api.value.playbackSpeed = store.playbackSpeed
      isReady.value = true
      sessionStats.value = { totalBeats: 0, successBeats: 0 }
      store.resetFatigue()
    })

    // Chaque beat joué → logique RPG
    api.value.playedBeatChanged.on((beat) => {
      if (!beat) return
      sessionStats.value.totalBeats++

      // Jet de dé pour chaque note du beat
      for (const note of beat.notes ?? []) {
        const { success, semitones } = rollNoteAccuracy(store.accuracyThreshold, note, prevPitch)
        if (success) {
          sessionStats.value.successBeats++
        } else {
          // Déviation audio : transposer la piste temporairement
          if (semitones !== 0) {
            api.value.changeTrackTranspositionPitch(api.value.tracks, semitones)
            // Remettre à 0 après 200ms
            setTimeout(() => api.value.changeTrackTranspositionPitch(api.value.tracks, 0), 200)
          }
        }
        prevPitch = note.realValue ?? note.value ?? prevPitch
      }

      // Draîner la fatigue
      const bpm = api.value.score?.tempo ?? 120
      store.drainFatigue(fatiguePerBeat(store.character.endurance, bpm))

      // Endurance épuisée → pause
      if (store.fatigue <= 0) {
        api.value.pause()
        isPlaying.value = false
      }
    })

    api.value.playerStateChanged.on(({ state }) => {
      isPlaying.value = state === alphaTab.PlayerState.Playing
    })

    // Fin de partition → XP + sauvegarde
    api.value.playerFinished.on(() => {
      const accuracy = sessionStats.value.totalBeats > 0
        ? sessionStats.value.successBeats / sessionStats.value.totalBeats
        : 0
      store.applySessionXP({
        title: api.value.score?.title ?? 'Partition inconnue',
        accuracy,
        completed: store.fatigue > 0,
        beatCount: sessionStats.value.totalBeats,
      })
      isPlaying.value = false
    })
  }

  function loadFile(file) {
    if (!api.value) return
    const reader = new FileReader()
    reader.onload = (e) => api.value.load(e.target.result)
    reader.readAsArrayBuffer(file)
  }

  function playPause() {
    api.value?.playPause()
  }

  function stop() {
    api.value?.stop()
  }

  onUnmounted(() => {
    api.value?.destroy()
  })

  return { init, loadFile, playPause, stop, isReady, isPlaying, sessionStats }
}
```

---

## Étape 5 — Composants Vue

### `FileDropzone.vue`

Zone drag & drop pour importer une partition. Émet `file-loaded` avec l'objet `File`.

- Accepter : `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`, `.xml`, `.musicxml`
- Afficher le nom du fichier une fois chargé
- Styliser le drop actif avec une bordure en pointillés

### `ScorePlayer.vue`

Composant principal. Contient le `div` cible alphaTab et les contrôles.

```vue
<template>
  <div>
    <FileDropzone @file-loaded="loadFile" />
    <div ref="playerContainer" style="width: 100%; min-height: 300px;" />
    <div v-if="isReady">
      <button @click="playPause">{{ isPlaying ? 'Pause' : 'Jouer' }}</button>
      <button @click="stop">Stop</button>
      <!-- Jauge de fatigue -->
      <div>
        <label>Fatigue</label>
        <progress :value="store.fatigue" max="1" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAlphaTab } from '@/composables/useAlphaTab'
import { useCharacterStore } from '@/stores/character'
import FileDropzone from './FileDropzone.vue'

const playerContainer = ref(null)
const store = useCharacterStore()
const { init, loadFile, playPause, stop, isReady, isPlaying } = useAlphaTab(playerContainer)

onMounted(() => init())
</script>
```

### `CharacterStats.vue`

Affiche les 3 stats du personnage sous forme de barres de progression animées.
- Chaque stat : label + barre (`<progress>`) + valeur en %
- Utiliser `useCharacterStore()` directement
- Animer la barre avec `transition: width 0.4s ease` quand la valeur change

### `SessionResult.vue`

Affiché après `playerFinished`. Reçoit les props :
- `accuracy` (number 0–1)
- `completed` (boolean)
- `xpGained` (object `{ speed, dexterity, endurance }`)

Afficher : récapitulatif de session + gains de stats + bouton "Rejouer".

---

## Étape 6 — `App.vue` (assemblage)

```vue
<template>
  <main>
    <h1>AlphaTab RPG</h1>
    <CharacterStats />
    <ScorePlayer />
  </main>
</template>

<script setup>
import { onMounted } from 'vue'
import { useCharacterStore } from '@/stores/character'
import CharacterStats from '@/components/CharacterStats.vue'
import ScorePlayer from '@/components/ScorePlayer.vue'

const store = useCharacterStore()
onMounted(() => store.load()) // charger la sauvegarde au démarrage
</script>
```

---

## Étape 7 — `main.js`

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

---

## Ordre d'exécution pour Claude Code

1. Initialiser le projet (Étape 0) et vérifier que `vite.config.js` est correct
2. Créer la structure de fichiers (Étape 1) — fichiers vides si nécessaire
3. Implémenter `stores/character.js` (Étape 2) — copier exactement le code fourni
4. Implémenter `utils/rpgEngine.js` (Étape 3)
5. Implémenter `composables/useAlphaTab.js` (Étape 4)
6. Implémenter `components/FileDropzone.vue` (Étape 5 — spec seulement, générer le code)
7. Implémenter `components/ScorePlayer.vue` (Étape 5 — code fourni, compléter les imports)
8. Implémenter `components/CharacterStats.vue` (Étape 5 — spec seulement)
9. Implémenter `components/SessionResult.vue` (Étape 5 — spec seulement)
10. Assembler `App.vue` et `main.js` (Étapes 6 et 7)
11. Lancer `npm run dev` et vérifier que la page charge sans erreur console
12. Tester avec un fichier `.gp` ou `.xml` : vérifier que la partition s'affiche et que le playback démarre

---

## Contraintes à respecter absolument

- **Ne jamais stocker un fichier de partition** dans localStorage (quota 5 Mo)
- **`api.changeTrackTranspositionPitch`** doit toujours être remis à `0` après l'erreur audio
- **La sauvegarde** (`store.save()`) n'est appelée **que** dans `applySessionXP`, jamais ailleurs
- **Tous les calculs RPG** (jets de dé, fatigue, XP) restent dans `rpgEngine.js`, pas dans les composants
- **alphaTab** ne doit être instancié **qu'une seule fois** par session (dans `useAlphaTab.js`)

---

## Ce que ce proto ne fait PAS (hors scope)

- Compte utilisateur / backend
- Comparaison entre partitions
- Système de niveaux / paliers
- Catalogue de partitions intégré
- Sons d'erreur personnalisés (l'erreur est audio via transposition)
- Support mobile

---

## Vérification finale

Le proto est prêt si :
- [ ] Une partition peut être importée par drag & drop
- [ ] La lecture démarre à `playbackSpeed` correspondant à la stat vitesse
- [ ] Les "erreurs" de notes sont audibles (transposition brève)
- [ ] La jauge de fatigue se vide pendant la lecture
- [ ] La lecture s'arrête si la fatigue atteint 0
- [ ] L'écran de résultats apparaît après `playerFinished`
- [ ] Les stats du personnage ont augmenté
- [ ] Fermer et rouvrir l'onglet restaure la progression
