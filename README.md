# AlphaTab RPG

Prototype de jeu incrémental musical : un personnage débute avec des stats faibles, importe une partition, et alphaTab la lit. Les stats (vitesse, dextérité, endurance) altèrent la lecture en temps réel et progressent à chaque partition jouée.

Voir [specs/PLAN_PROTO_ALPHATAB_RPG.md](specs/PLAN_PROTO_ALPHATAB_RPG.md) pour les spécifications complètes.

---

## Prérequis

- **Node.js ≥ 20.19** (ou ≥ 22.12) — requis par Vite 7
- **npm ≥ 9**

Vérifier :

```bash
node --version
npm --version
```

---

## Installation

```bash
git clone <url-du-repo> alphatabrpg
cd alphatabrpg
npm install
```

L'installation tire automatiquement :

- `vue@^3.5` + `pinia@^3` — UI et state management
- `@coderline/alphatab@^1.8` — moteur de lecture/affichage de partitions
- `@coderline/alphatab-vite@^1.8` — plugin Vite (workers, worklets, SoundFont SONiVOX servis automatiquement)
- `vite@^7` + `@vitejs/plugin-vue@^6` — build

> ⚠️ **Compatibilité Vite** : utiliser Vite 7. Vite 8 (rolldown) casse `@coderline/alphatab-vite@1.8` avec une erreur `Missing field moduleType`.

---

## Scripts disponibles

| Commande | Action |
|---|---|
| `npm run dev` | Serveur de dev avec HMR sur http://localhost:5173 |
| `npm run build` | Build production dans `dist/` |
| `npm run preview` | Sert le build de production localement |

---

## Configuration

Aucune variable d'environnement n'est requise. Tout tourne dans le navigateur, sans backend.

### `vite.config.js`

Le plugin `alphaTab()` doit être actif pour que les workers, worklets et le SoundFont soient correctement servis. Un alias `@` → `src` est défini pour les imports.

```js
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { alphaTab } from '@coderline/alphatab-vite'

export default defineConfig({
  plugins: [vue(), alphaTab()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

---

## Structure du projet

```
src/
├── main.js                    # Bootstrap Vue + Pinia
├── App.vue                    # Layout principal
├── stores/
│   └── character.js           # Pinia store (stats, fatigue, historique, save/load)
├── composables/
│   └── useAlphaTab.js         # Encapsulation de l'API alphaTab
├── components/
│   ├── ScorePlayer.vue        # Conteneur alphaTab + contrôles
│   ├── FileDropzone.vue       # Import drag & drop
│   ├── CharacterStats.vue     # Barres de stats
│   └── SessionResult.vue      # Récapitulatif post-partition
└── utils/
    └── rpgEngine.js           # Calculs purs : jets de dés, fatigue, difficulté
```

---

## Utilisation

1. Lance `npm run dev` puis ouvre http://localhost:5173.
2. Dépose une partition dans la zone d'import. Formats acceptés :
   - Guitar Pro : `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`
   - MusicXML : `.xml`, `.musicxml`
3. Clique sur **Jouer**. La vitesse de lecture, la précision des notes et la jauge de fatigue dépendent des stats du personnage.
4. À la fin (`playerFinished`) ou si la fatigue tombe à 0, l'écran de récap affiche les gains d'XP.

---

## Persistance

La progression est sauvegardée en `localStorage` sous la clé `alphatab_rpg_save`, **uniquement** à la fin de chaque partition. Fermer/rouvrir l'onglet restaure le personnage.

Pour réinitialiser :

```js
// Dans la console du navigateur
localStorage.removeItem('alphatab_rpg_save')
location.reload()
```

Les fichiers de partition ne sont **jamais** stockés (quota localStorage de 5 Mo).

---

## Dépannage

- **`Missing field moduleType` au build** : Vite 8 est installé. Forcer Vite 7 :
  ```bash
  npm install --save-dev vite@^7 @vitejs/plugin-vue@^6
  ```
- **`PlayerState is not exported`** : utiliser `alphaTab.synth.PlayerState` (et pas `alphaTab.PlayerState`).
- **Pas de son** : vérifier que le navigateur autorise l'audio (cliquer sur la page avant `Jouer`) et que le SoundFont SONiVOX est chargé (Network tab → `sonivox.sf2` doit retourner 200).
