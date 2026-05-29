import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { alphaTab } from '@coderline/alphatab-vite'
import fs from 'node:fs/promises'
import path from 'node:path'

const TAB_EXTS = new Set([
  '.gp', '.gp3', '.gp4', '.gp5', '.gpx', '.xml', '.musicxml',
])

function parseFilename(filename) {
  const ext = path.extname(filename)
  let base = path.basename(filename, ext)
  // Strip trailing parenthesized content: "(ver 2 by emad)"
  base = base.replace(/\s*\([^)]*\)\s*$/, '').trim()
  // Strip trailing dates: "-05-15-2026", "-2026-05-15", "-2026"
  base = base.replace(/[-_\s]+\d{1,2}[-_\s]\d{1,2}[-_\s]\d{2,4}$/, '').trim()
  base = base.replace(/[-_\s]+\d{4}[-_\s]\d{1,2}[-_\s]\d{1,2}$/, '').trim()
  base = base.replace(/[-_\s]+\d{4}$/, '').trim()

  // Lesson-style numeric prefix ("1 - Intro", "02 - Pentatonic"): keep the
  // whole base as the title so it stays visible and sorts naturally with the
  // numeric collator. No artist split.
  if (/^\d+\s*-\s+/.test(base)) {
    return { artist: '', title: base }
  }

  // Prefer " - " (space-hyphen-space) as artist/title separator.
  let dashIdx = base.indexOf(' - ')
  let sepLen = 3
  if (dashIdx < 0) {
    // Fallback to a bare hyphen.
    dashIdx = base.indexOf('-')
    sepLen = 1
  }
  if (dashIdx > 0) {
    return {
      artist: base.slice(0, dashIdx).trim() || 'Unknown',
      title: base.slice(dashIdx + sepLen).trim() || base,
    }
  }
  return { artist: 'Unknown', title: base }
}

async function readCategoriesConfig(tabsDir) {
  const configPath = path.join(tabsDir, 'categories.json')
  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.categories)) return null
    return parsed.categories
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[tabs-index] Failed to read categories.json:', err.message)
    }
    return null
  }
}

async function readRewardsConfig(tabsDir) {
  const configPath = path.join(tabsDir, 'rewards.json')
  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.rewards)) return []
    return parsed.rewards
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[tabs-index] Failed to read rewards.json:', err.message)
    }
    return []
  }
}

async function listTabsInCategory(tabsDir, categoryId, base) {
  const categoryDir = path.join(tabsDir, categoryId)
  let entries
  try {
    entries = await fs.readdir(categoryDir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && TAB_EXTS.has(path.extname(e.name).toLowerCase()))
    .map((e) => {
      const { artist, title } = parseFilename(e.name)
      return {
        id: `${categoryId}/${e.name}`,
        category: categoryId,
        artist,
        title,
        file: `${base}tabs/${encodeURIComponent(categoryId)}/${encodeURIComponent(e.name)}`,
      }
    })
    .sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }),
    )
}

async function buildTabsManifest(tabsDir, base) {
  const categories = await readCategoriesConfig(tabsDir)
  if (!categories) {
    console.warn('[tabs-index] No categories.json at the root of public/tabs/. Manifest will be empty.')
    return { categories: [], tabs: [], rewards: [] }
  }

  const sortedCategories = [...categories].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  )

  const tabs = []
  const normalizedCategories = []
  for (const cat of sortedCategories) {
    const catTabs = await listTabsInCategory(tabsDir, cat.id, base)
    tabs.push(...catTabs)
    normalizedCategories.push({
      id: cat.id,
      label: cat.label ?? cat.id,
      description: cat.description ?? '',
      order: cat.order ?? 0,
      unlock: cat.unlock ?? { type: 'always' },
      hint: cat.hint ?? null,
    })
  }

  // Rewards live in their own config file. Each reward has a unique `id`, a
  // `trigger` (currently only `category_completed`, extensible to time / streak
  // / stat thresholds in the future), and an `effects` array of stat changes.
  const rawRewards = await readRewardsConfig(tabsDir)
  const rewards = rawRewards
    .filter((r) => r && typeof r.id === 'string' && r.trigger && Array.isArray(r.effects))
    .map((r) => ({
      id: r.id,
      label: r.label ?? r.id,
      hint: r.hint ?? null,
      trigger: r.trigger,
      effects: r.effects,
    }))

  return { categories: normalizedCategories, tabs, rewards }
}

function tabsIndexPlugin() {
  const tabsDir = fileURLToPath(new URL('./public/tabs', import.meta.url))
  let resolvedBase = '/'
  return {
    name: 'tabs-index',
    configResolved(config) {
      resolvedBase = config.base || '/'
    },
    configureServer(server) {
      // Match both base-prefixed and root URLs so the manifest works regardless
      // of how the dev server is configured (base: '/' vs '/alphatabrpg/').
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        const baseManifest = `${resolvedBase}tabs/index.json`
        if (url !== baseManifest && url !== '/tabs/index.json') return next()
        try {
          const manifest = await buildTabsManifest(tabsDir, resolvedBase)
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(manifest))
        } catch (err) {
          next(err)
        }
      })
    },
    async generateBundle() {
      const manifest = await buildTabsManifest(tabsDir, resolvedBase)
      this.emitFile({
        type: 'asset',
        fileName: 'tabs/index.json',
        source: JSON.stringify(manifest, null, 2),
      })
    },
  }
}

export default defineConfig({
  base: '/alphatabrpg/',
  plugins: [vue(), alphaTab(), tabsIndexPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Modern Sass API; silences the legacy-api deprecation warning.
        api: 'modern-compiler',
      },
    },
  },
})
