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

async function listTabsInCategory(tabsDir, categoryId) {
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
        file: `/tabs/${encodeURIComponent(categoryId)}/${encodeURIComponent(e.name)}`,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

async function buildTabsManifest(tabsDir) {
  const categories = await readCategoriesConfig(tabsDir)
  if (!categories) {
    console.warn('[tabs-index] No categories.json at the root of public/tabs/. Manifest will be empty.')
    return { categories: [], tabs: [] }
  }

  const sortedCategories = [...categories].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  )

  const tabs = []
  const normalizedCategories = []
  for (const cat of sortedCategories) {
    const catTabs = await listTabsInCategory(tabsDir, cat.id)
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

  return { categories: normalizedCategories, tabs }
}

function tabsIndexPlugin() {
  const tabsDir = fileURLToPath(new URL('./public/tabs', import.meta.url))
  return {
    name: 'tabs-index',
    configureServer(server) {
      server.middlewares.use('/tabs/index.json', async (req, res, next) => {
        try {
          const manifest = await buildTabsManifest(tabsDir)
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(manifest))
        } catch (err) {
          next(err)
        }
      })
    },
    async generateBundle() {
      const manifest = await buildTabsManifest(tabsDir)
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
})
